import { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { BotContext } from '../middleware/auth.js';
import { getStoresForUser, Store } from '../../db/queries/stores.js';
import { createVisit } from '../../db/queries/visits.js';
import { uploadVisitPhoto } from '../../db/queries/photos.js';
import { buildStorePicker } from '../keyboards/store-picker.js';
import { categoriesFilled } from '../../utils/format.js';
import { config } from '../../config.js';

type VisitConversation = Conversation<BotContext, BotContext>;

export async function visitFlow(conversation: VisitConversation, ctx: BotContext): Promise<void> {
  const user = ctx.user;
  if (!user) {
    await ctx.reply("You're not registered. Contact your manager to get set up.");
    return;
  }

  // Step 1: Pick a store
  const stores = await conversation.external(() => getStoresForUser(user.id));
  if (stores.length === 0) {
    await ctx.reply("You don't have any stores assigned. Contact your manager.");
    return;
  }

  await ctx.reply('Which store did you visit?', {
    reply_markup: buildStorePicker(stores),
  });

  const storeCallback = await conversation.waitForCallbackQuery(/^(store:|cancel$)/);

  if (storeCallback.match === 'cancel') {
    await storeCallback.answerCallbackQuery('Cancelled');
    await ctx.reply('Visit cancelled.');
    return;
  }

  const storeId = storeCallback.callbackQuery.data!.replace('store:', '');
  const store = stores.find((s: Store) => s.id === storeId);
  if (!store) {
    await storeCallback.answerCallbackQuery('Store not found');
    return;
  }

  await storeCallback.answerCallbackQuery();
  await ctx.reply(
    `Got it — *${store.name}*\n\n` +
    `Let's walk through your visit. Type naturally for each section.\n` +
    `Use the Skip button if a category doesn't apply.`,
    { parse_mode: 'Markdown' },
  );

  // Step 2-5: Collect R/T/E/C notes
  const relationshipNotes = await collectCategory(
    conversation, ctx,
    '👥 *RELATIONSHIP*\nHow many staff did you engage? Any key insights from conversations?',
  );

  const trainingNotes = await collectCategory(
    conversation, ctx,
    '🎓 *TRAINING*\nWho did you train? What products? Any ally-ready staff?',
  );

  const experienceNotes = await collectCategory(
    conversation, ctx,
    '🏪 *EXPERIENCE*\nHow\'s the display? Demo units working? Any space gained or lost?',
  );

  const creativeNotes = await collectCategory(
    conversation, ctx,
    '💡 *CREATIVE METHODS*\nAny innovative tactics you tried?',
  );

  // Step 6: Photos
  await ctx.reply(
    '📸 *PHOTOS*\nSend photos now (display, demo, shelf), or tap Done.',
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard().text('Done — no photos', 'photos:done'),
    },
  );

  const photoFileIds: string[] = [];
  let collectingPhotos = true;

  while (collectingPhotos) {
    const photoCtx = await conversation.wait();

    if (photoCtx.callbackQuery?.data === 'photos:done') {
      await photoCtx.answerCallbackQuery();
      collectingPhotos = false;
    } else if (photoCtx.message?.photo) {
      const photos = photoCtx.message.photo;
      const largest = photos[photos.length - 1];
      photoFileIds.push(largest.file_id);

      await photoCtx.reply(
        `${photoFileIds.length} photo(s) received. Send more or tap Done.`,
        {
          reply_markup: new InlineKeyboard().text('Done', 'photos:done'),
        },
      );
    } else if (photoCtx.message?.text === '/cancel') {
      await ctx.reply('Visit cancelled.');
      return;
    } else {
      await photoCtx.reply('Send a photo, or tap Done to continue.');
    }
  }

  // Step 7: Save to Supabase
  await ctx.reply('Saving your visit...');

  const visit = await conversation.external(() =>
    createVisit({
      store_id: storeId,
      user_id: user.id,
      relationship_notes: relationshipNotes,
      training_notes: trainingNotes,
      experience_notes: experienceNotes,
      creative_notes: creativeNotes,
    }),
  );

  if (!visit) {
    await ctx.reply('Something went wrong saving your visit. Please try again with /visit.');
    return;
  }

  // Upload photos
  if (photoFileIds.length > 0) {
    let uploaded = 0;
    for (const fileId of photoFileIds) {
      try {
        const file = await ctx.api.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${config.telegram.botToken}/${file.file_path}`;
        const response = await fetch(fileUrl);
        const buffer = Buffer.from(await response.arrayBuffer());
        const fileName = `${crypto.randomUUID()}.jpg`;

        await conversation.external(() =>
          uploadVisitPhoto(visit.id, buffer, fileName, user.market, storeId),
        );
        uploaded++;
      } catch (err) {
        console.error('Photo upload failed:', err);
      }
    }
    if (uploaded < photoFileIds.length) {
      await ctx.reply(`⚠️ ${uploaded}/${photoFileIds.length} photos uploaded. Some failed — you can add them later with /editvisit.`);
    }
  }

  // Step 8: Confirmation
  const cats = categoriesFilled({
    relationship_notes: relationshipNotes,
    training_notes: trainingNotes,
    experience_notes: experienceNotes,
    creative_notes: creativeNotes,
  });

  let confirmation =
    `✅ *VISIT LOGGED — ${store.name}*\n` +
    `📅 ${new Date().toLocaleDateString('en-GB')}\n` +
    `📝 Categories: ${cats.length > 0 ? cats.join(' / ') : 'none'}\n` +
    `📸 Photos: ${photoFileIds.length}`;

  if (config.anthropic.apiKey) {
    // TODO Phase 5: Run Claude analysis and show health/momentum summary
    confirmation += '\n\n🤖 AI analysis will be available once connected.';
  }

  confirmation += '\n\nUse /editvisit to make changes.';

  await ctx.reply(confirmation, { parse_mode: 'Markdown' });
}

async function collectCategory(
  conversation: VisitConversation,
  ctx: BotContext,
  prompt: string,
): Promise<string | null> {
  await ctx.reply(prompt, {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard().text('Skip', 'category:skip'),
  });

  const response = await conversation.wait();

  if (response.callbackQuery?.data === 'category:skip') {
    await response.answerCallbackQuery('Skipped');
    return null;
  }

  if (response.message?.text === '/cancel') {
    throw new Error('CANCELLED');
  }

  if (response.message?.text) {
    return response.message.text;
  }

  return null;
}
