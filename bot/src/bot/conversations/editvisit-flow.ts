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
    await ctx.reply("You're not registered. Contact your manager to get set up.");
    return;
  }

  // Show recent visits
  const visits = await conversation.external(() => getRecentVisitsByUser(user.id, 7));

  if (visits.length === 0) {
    await ctx.reply('No recent visits to edit. Use /visit to log one first.');
    return;
  }

  const kb = new InlineKeyboard();
  for (const v of visits) {
    const storeName = (v as any).stores?.name || 'Unknown store';
    const date = new Date(v.visit_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
    kb.text(`${storeName} — ${date}`, `ev:${v.id}`).row();
  }
  kb.text('Cancel', 'ev:cancel').row();

  await ctx.reply('Which visit do you want to edit?', { reply_markup: kb });

  const pick = await conversation.waitForCallbackQuery(/^ev:/);
  await pick.answerCallbackQuery();

  if (pick.callbackQuery.data === 'ev:cancel') {
    await ctx.reply('Edit cancelled.');
    return;
  }

  const visitId = pick.callbackQuery.data!.replace('ev:', '');
  const visit = await conversation.external(() => getVisitById(visitId));

  if (!visit) {
    await ctx.reply('Visit not found.');
    return;
  }

  const storeName = (visit as any).stores?.name || 'Unknown store';
  const notes = visit.visit_notes || visit.raw_notes_combined || '(no notes)';

  await ctx.reply(
    `*${storeName}* — ${new Date(visit.visit_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}\n\n` +
    `Current notes:\n${notes}\n\n` +
    `What would you like to do?`,
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .text('Replace notes', 'edit:notes').row()
        .text('Add photos', 'edit:photos').row()
        .text('Cancel', 'edit:cancel'),
    },
  );

  const action = await conversation.waitForCallbackQuery(/^edit:/);
  await action.answerCallbackQuery();

  if (action.callbackQuery.data === 'edit:cancel') {
    await ctx.reply('Edit cancelled.');
    return;
  }

  if (action.callbackQuery.data === 'edit:notes') {
    await ctx.reply('Send your updated notes:');
    const noteCtx = await conversation.wait();

    if (noteCtx.message?.text === '/cancel') {
      await ctx.reply('Edit cancelled.');
      return;
    }

    if (noteCtx.message?.text) {
      const updated = await conversation.external(() =>
        updateVisitNotes(visitId, noteCtx.message!.text!, user.id),
      );

      if (updated) {
        await ctx.reply('Notes updated.');
      } else {
        await ctx.reply('Failed to update notes.');
      }
    }
  }

  if (action.callbackQuery.data === 'edit:photos') {
    await ctx.reply('Send photos anytime — tap Done when finished.', {
      reply_markup: new InlineKeyboard().text('Done', 'editphotos:done'),
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
            uploadVisitPhoto(visitId, buffer, fileName, user.market, visit.store_id),
          );
          count++;
          await ctx.reply(`${count} photo(s) added. Send more or tap Done.`, {
            reply_markup: new InlineKeyboard().text('Done', 'editphotos:done'),
          });
        } catch (err) {
          console.error('Photo upload failed:', err);
          await ctx.reply('Photo upload failed. Try again.');
        }
      } else if (photoCtx.message?.text === '/cancel') {
        await ctx.reply('Edit cancelled.');
        return;
      } else {
        await ctx.reply('Send a photo, or tap Done if you\'re finished.', {
          reply_markup: new InlineKeyboard().text('Done', 'editphotos:done'),
        });
      }
    }

    if (count > 0) {
      await ctx.reply(`${count} photo(s) added to your visit.`);
    }
  }
}
