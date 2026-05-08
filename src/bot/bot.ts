import { Bot, InlineKeyboard, session } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import { config } from '../config.js';
import { BotContext, authMiddleware, requireAuth } from './middleware/auth.js';
import { handleStart } from './commands/start.js';
import { handleNickname } from './commands/nickname.js';
import { handleMyProfile, handleProfileStores, handleProfileVisits, handleProfileBack } from './commands/myprofile.js';
import { handleCancel } from './commands/cancel.js';
import { handleGrantAccess } from './commands/admin/grant.js';
import { handleRevokeAccess } from './commands/admin/revoke.js';
import { handleListAccess } from './commands/admin/list.js';
import { handleDashboard } from './commands/dashboard.js';
import { visitFlow } from './conversations/visit-flow.js';
import { initPhotoCollection, isCollecting, handleIncomingPhoto } from './photo-collection.js';
import { startEditSession, isEditing, getEditSession, clearEditSession } from './edit-session.js';
import { getVisitInfo, updateVisitSections, deleteVisit } from '../db/queries/visits.js';
import { parseTemplate, filledCount } from '../utils/parse-template.js';
import { sendVisitDetails } from './visit-details.js';

export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(config.telegram.botToken);
  initPhotoCollection(bot.api);

  bot.use(session({ initial: () => ({}) }));
  bot.use(conversations());
  bot.use(authMiddleware);

  bot.use(createConversation(visitFlow));

  bot.command('start', handleStart);
  bot.command('nickname', handleNickname);
  bot.command('myprofile', handleMyProfile);
  bot.command('cancel', handleCancel);

  bot.command('dashboard', handleDashboard);

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
      await ctx.reply("Edit cancelled — no changes made 👍");
      return;
    }

    clearEditSession(telegramId);
    const sections = parseTemplate(text);
    const filled = filledCount(sections);
    const ok = await updateVisitSections(session.visitId, sections);

    if (ok) {
      await ctx.reply(`✅ Updated — ${session.storeName} · ${filled}/6 sections`);
    } else {
      await ctx.reply("Something went wrong — give it another try 🙏");
    }
  });

  // View full last visit — fired from the pre-visit context block
  bot.callbackQuery(/^viewlast:/, async (ctx) => {
    const visitId = ctx.callbackQuery.data.replace('viewlast:', '');
    await ctx.answerCallbackQuery();
    await sendVisitDetails(ctx, visitId);
  });

  // View a specific visit — fired from /myvisits and /storevisits inline buttons
  bot.callbackQuery(/^viewvisit:/, async (ctx) => {
    const visitId = ctx.callbackQuery.data.replace('viewvisit:', '');
    await ctx.answerCallbackQuery();
    await sendVisitDetails(ctx, visitId);
  });

  // /myprofile inline expansions
  bot.callbackQuery('profile:stores', handleProfileStores);
  bot.callbackQuery('profile:visits', handleProfileVisits);
  bot.callbackQuery('profile:back', handleProfileBack);

  // Confirm button — visit is already saved; this closes the action bar
  bot.callbackQuery(/^confirm_visit:/, async (ctx) => {
    await ctx.answerCallbackQuery('Confirmed ✅');
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
      `Send your updated notes for *${info.store_name}* and I'll swap them in 🔄\n\n` +
      `\`\`\`\n1️⃣ Good News\n\n\n2️⃣ Competitors' Insights\n\n\n3️⃣ Display & Stock\n\n\n4️⃣ What to Follow Up\n\n\n5️⃣ Buzz Plan\n\n\n6️⃣ Training\n\`\`\`\n\n/cancel to stop\\.`,
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
    await ctx.reply(`Delete the visit to *${info.store_name}*? This can't be undone\\.`, {
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
      await ctx.reply("Something went wrong — give it another try 🙏");
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
