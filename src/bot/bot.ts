import { Bot, InlineKeyboard, session } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import { config } from '../config.js';
import { BotContext, authMiddleware, requireAuth } from './middleware/auth.js';
import { handleStart } from './commands/start.js';
import { handleHelp } from './commands/help.js';
import { handleMyStores } from './commands/mystores.js';
import { handleMyVisits } from './commands/myvisits.js';
import { handleCancel } from './commands/cancel.js';
import { handleGrantAccess } from './commands/admin/grant.js';
import { handleRevokeAccess } from './commands/admin/revoke.js';
import { handleListAccess } from './commands/admin/list.js';
import { visitFlow } from './conversations/visit-flow.js';
import { initPhotoCollection, isCollecting, handleIncomingPhoto } from './photo-collection.js';
import { startEditSession, isEditing, getEditSession, clearEditSession } from './edit-session.js';
import { getVisitInfo, updateVisitSections, deleteVisit } from '../db/queries/visits.js';
import { parseTemplate, filledCount } from '../utils/parse-template.js';

export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(config.telegram.botToken);
  initPhotoCollection(bot.api);

  bot.use(session({ initial: () => ({}) }));
  bot.use(conversations());
  bot.use(authMiddleware);

  bot.use(createConversation(visitFlow));

  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command('mystores', handleMyStores);
  bot.command('myvisits', handleMyVisits);
  bot.command('cancel', handleCancel);

  bot.command('visit', async (ctx) => {
    const user = requireAuth(ctx);
    if (!user) return;
    await ctx.conversation.enter('visitFlow');
  });

  // Photo debounce handler — runs after conversation exits, catches album photos
  bot.on('message:photo', async (ctx) => {
    const telegramId = ctx.from?.id ?? 0;
    if (!isCollecting(telegramId)) return;
    const p = ctx.message?.photo;
    if (p) await handleIncomingPhoto(telegramId, p[p.length - 1].file_id);
  });

  // Edit mode: CM resends filled template after tapping ✏️ Edit
  bot.on(['message:text', 'message:caption'], async (ctx, next) => {
    const telegramId = ctx.from?.id ?? 0;
    if (!isEditing(telegramId)) return next();

    const session = getEditSession(telegramId);
    if (!session) return next();

    const text = ctx.message?.caption ?? ctx.message?.text ?? '';

    if (text === '/cancel') {
      clearEditSession(telegramId);
      await ctx.reply('Edit cancelled.');
      return;
    }

    clearEditSession(telegramId);
    const sections = parseTemplate(text);
    const filled = filledCount(sections);
    const ok = await updateVisitSections(session.visitId, sections);

    if (ok) {
      await ctx.reply(`✅ Visit updated — ${session.storeName}\n📝 ${filled}/5 sections filled`);
    } else {
      await ctx.reply('Something went wrong updating your visit. Please try again.');
    }
  });

  // Confirm button — visit is already saved; this closes the action bar
  bot.callbackQuery(/^confirm_visit:/, async (ctx) => {
    await ctx.answerCallbackQuery('Visit confirmed! ✅');
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
  });

  // Edit button — send the template back and enter edit mode
  bot.callbackQuery(/^edit:/, async (ctx) => {
    const visitId = ctx.callbackQuery.data.replace('edit:', '');
    const info = await getVisitInfo(visitId);

    if (!info) {
      await ctx.answerCallbackQuery('Visit not found.');
      return;
    }
    if (info.cm_telegram_id !== ctx.from?.id) {
      await ctx.answerCallbackQuery('Not your visit.');
      return;
    }

    startEditSession(ctx.from.id, visitId, info.store_name);
    await ctx.answerCallbackQuery();
    await ctx.reply(
      `Send your updated notes for *${info.store_name}* and I'll replace the current entry\\.\n\n` +
      `\`\`\`\n1️⃣ Good News\n\n\n2️⃣ Competitors' Insights\n\n\n3️⃣ Display & Stock\n\n\n4️⃣ What to Follow Up\n\n\n5️⃣ Buzz Plan\n\`\`\`\n\nType /cancel to abort\\.`,
      { parse_mode: 'MarkdownV2' },
    );
  });

  // Delete button — ask for confirmation
  bot.callbackQuery(/^delete:/, async (ctx) => {
    const visitId = ctx.callbackQuery.data.replace('delete:', '');
    const info = await getVisitInfo(visitId);

    if (!info) {
      await ctx.answerCallbackQuery('Visit not found.');
      return;
    }
    if (info.cm_telegram_id !== ctx.from?.id) {
      await ctx.answerCallbackQuery('Not your visit.');
      return;
    }

    await ctx.answerCallbackQuery();
    await ctx.reply(`Delete the visit to *${info.store_name}*? This cannot be undone\\.`, {
      parse_mode: 'MarkdownV2',
      reply_markup: new InlineKeyboard()
        .text('Yes, delete', `confirm_delete:${visitId}`)
        .text('Cancel', 'cancel_action'),
    });
  });

  // Confirm delete
  bot.callbackQuery(/^confirm_delete:/, async (ctx) => {
    const visitId = ctx.callbackQuery.data.replace('confirm_delete:', '');
    const info = await getVisitInfo(visitId);

    if (info && info.cm_telegram_id !== ctx.from?.id) {
      await ctx.answerCallbackQuery('Not your visit.');
      return;
    }

    const ok = await deleteVisit(visitId);
    await ctx.answerCallbackQuery();

    if (ok) {
      await ctx.editMessageText('🗑️ Visit deleted.');
    } else {
      await ctx.reply('Something went wrong. Please try again.');
    }
  });

  // Cancel delete confirmation
  bot.callbackQuery('cancel_action', async (ctx) => {
    await ctx.answerCallbackQuery('Cancelled.');
    await ctx.deleteMessage().catch(() => {});
  });

  // Admin commands
  bot.command('grantaccess', handleGrantAccess);
  bot.command('revokeaccess', handleRevokeAccess);
  bot.command('listaccess', handleListAccess);

  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error handling update ${ctx.update.update_id}:`, err.error);

    const message =
      err.error instanceof Error && err.error.message === 'CANCELLED'
        ? 'Action cancelled.'
        : 'Something went wrong. Try again or type /cancel to reset.';

    ctx.reply(message).catch(console.error);
  });

  return bot;
}
