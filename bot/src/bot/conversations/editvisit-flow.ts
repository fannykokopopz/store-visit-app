import { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { BotContext } from '../middleware/auth.js';
import { getRecentVisitsByUser, getVisitById, updateVisitNotes, Visit } from '../../db/queries/visits.js';
import { uploadVisitPhoto } from '../../db/queries/photos.js';
import { config } from '../../config.js';

type EditConversation = Conversation<BotContext, BotContext>;

export async function editVisitFlow(conversation: EditConversation, ctx: BotContext): Promise<void> {
  const chatId = ctx.from?.id;
  if (!chatId) return;

  const user = await conversation.external(async () => {
    const { getUserByTelegramId } = await import('../../db/queries/users.js');
    return getUserByTelegramId(chatId);
  });

  if (!user) {
    await ctx.reply("Hmm, I don't have you in the system yet. Check with your manager to get set up!");
    return;
  }

  // Show recent visits as numbered list
  const visits = await conversation.external(() => getRecentVisitsByUser(user.id, 10));

  if (visits.length === 0) {
    await ctx.reply("You don't have any recent visits to edit. Log one first with /visit!");
    return;
  }

  let listMsg = '📋 *Your recent visits:*\n\n';
  for (let i = 0; i < visits.length; i++) {
    const v = visits[i];
    const storeName = (v as any).stores?.name || 'Unknown store';
    const date = new Date(v.visit_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
    const hasNotes = v.visit_notes || v.raw_notes_combined;
    listMsg += `*${i + 1}.* ${storeName} — ${date}${hasNotes ? '' : ' _(no notes)_'}\n`;
  }
  listMsg += '\nType a number to pick one (e.g. *1*), or /cancel to go back.';

  await ctx.reply(listMsg, { parse_mode: 'Markdown' });

  // Wait for number selection
  let visit: Visit | null = null;
  let storeName = '';

  while (!visit) {
    const pickCtx = await conversation.wait();
    const text = pickCtx.message?.text?.trim();

    if (!text || text === '/cancel') {
      await ctx.reply('No worries, cancelled!');
      return;
    }

    const num = parseInt(text.replace(/^\//, ''), 10);

    if (isNaN(num) || num < 1 || num > visits.length) {
      await ctx.reply(`Just type a number between 1 and ${visits.length}.`);
      continue;
    }

    const selected = visits[num - 1];
    visit = await conversation.external(() => getVisitById(selected.id));
    storeName = (selected as any).stores?.name || 'Unknown store';

    if (!visit) {
      await ctx.reply("Hmm, couldn't find that visit. Pick another number?");
      visit = null;
    }
  }

  const notes = visit.visit_notes || visit.raw_notes_combined || '_(no notes)_';

  await ctx.reply(
    `*${storeName}* — ${new Date(visit.visit_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}\n\n` +
    `${notes}\n\n` +
    `What would you like to do?`,
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .text('✏️ Replace notes', 'edit:notes').row()
        .text('📸 Add photos', 'edit:photos').row()
        .text('← Cancel', 'edit:cancel'),
    },
  );

  const action = await conversation.wait();
  const actionData = action.callbackQuery?.data;
  if (action.callbackQuery) await action.answerCallbackQuery();

  if (!actionData?.startsWith('edit:') || actionData === 'edit:cancel') {
    await ctx.reply('No worries!');
    return;
  }

  if (actionData === 'edit:notes') {
    await ctx.reply("Send me the updated notes — I'll replace what's there.");
    const noteCtx = await conversation.wait();

    if (noteCtx.message?.text === '/cancel') {
      await ctx.reply('No worries, cancelled!');
      return;
    }

    if (noteCtx.message?.text) {
      const updated = await conversation.external(() =>
        updateVisitNotes(visit!.id, noteCtx.message!.text!, user.id),
      );

      await ctx.reply(updated
        ? 'Notes updated! ✓'
        : "Hmm, that didn't work. Try again later.");
    }
  }

  if (actionData === 'edit:photos') {
    await ctx.reply("Send me the photos — I'll add them to this visit. Hit Done when you're finished.", {
      reply_markup: new InlineKeyboard().text('✅ Done', 'editphotos:done'),
    });

    let addingPhotos = true;
    let count = 0;

    while (addingPhotos) {
      const photoCtx = await conversation.wait();

      if (photoCtx.callbackQuery?.data === 'editphotos:done') {
        await photoCtx.answerCallbackQuery();
        addingPhotos = false;
      } else if (photoCtx.message?.photo) {
        const photos = photoCtx.message.photo;
        const largest = photos[photos.length - 1];

        try {
          const file = await ctx.api.getFile(largest.file_id);
          const fileUrl = `https://api.telegram.org/file/bot${config.telegram.botToken}/${file.file_path}`;
          const res = await fetch(fileUrl);
          const buffer = Buffer.from(await res.arrayBuffer());
          const fileName = `${crypto.randomUUID()}.jpg`;

          await conversation.external(() =>
            uploadVisitPhoto(visit!.id, buffer, fileName, user.market, visit!.store_id),
          );
          count++;
          await ctx.reply(`${count} photo(s) added! Send more or hit Done. 📸`, {
            reply_markup: new InlineKeyboard().text('✅ Done', 'editphotos:done'),
          });
        } catch (err) {
          console.error('Photo upload failed:', err);
          await ctx.reply("That photo didn't go through — try sending it again?");
        }
      } else if (photoCtx.message?.text === '/cancel') {
        await ctx.reply('No worries, cancelled!');
        return;
      } else {
        await ctx.reply("Just send me a photo, or hit Done if you're finished.", {
          reply_markup: new InlineKeyboard().text('✅ Done', 'editphotos:done'),
        });
      }
    }

    if (count > 0) {
      await ctx.reply(`${count} photo(s) added to your visit! 🎉`);
    }
  }
}
