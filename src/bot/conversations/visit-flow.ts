import { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { BotContext } from '../middleware/auth.js';
import { getStoresForCM } from '../../db/queries/stores.js';
import { searchStoresByName, getStoreById } from '../../db/queries/stores.js';
import { createVisit, lockVisit, attachVisitSections, getLastVisitDatePerStore } from '../../db/queries/visits.js';
import { getActivePlan, consumePlan } from '../../db/queries/visit-plans.js';
import { buildStorePicker, buildSearchResultsPicker, buildStoreContextMessage } from '../keyboards/store-picker.js';
import { buildTemplateMessage } from '../../utils/template.js';
import { parseTemplate, filledCount } from '../../utils/parse-template.js';
import { startPhotoCollection } from '../photo-collection.js';
import { sendVisitDetails } from '../visit-details.js';

type VisitConversation = Conversation<BotContext, BotContext>;

export async function visitFlow(conversation: VisitConversation, ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  // ── Step 1: Store selection ────────────────────────────────────────────────

  const [stores, lastVisits] = await conversation.external(async () => {
    const s = await getStoresForCM(telegramId);
    const lv = await getLastVisitDatePerStore(telegramId);
    return [s, lv] as const;
  });

  if (stores.length === 0) {
    await ctx.reply("No stores assigned yet — ask your manager to set this up 🙏");
    return;
  }

  // Show context message with last-visit info, then picker with clean button labels
  await ctx.reply(buildStoreContextMessage(stores, lastVisits));

  let page = 0;
  await ctx.reply('Which store did you visit?', {
    reply_markup: buildStorePicker(stores, lastVisits, page),
  });

  let storeId = '';
  let storeName = '';

  storeLoop: while (true) {
    // Use conversation.wait() instead of waitForCallbackQuery so that a typed
    // /cancel still exits even if the picker message was deleted.
    const update = await conversation.wait();

    if (update.message?.text === '/cancel') {
      await ctx.reply("No worries — come back whenever you're ready 👋");
      return;
    }

    if (!update.callbackQuery) continue;

    const data = update.callbackQuery.data ?? '';

    if (data === 'cancel') {
      await update.answerCallbackQuery();
      await ctx.reply("No worries — come back whenever you're ready 👋");
      return;
    }

    // Pagination — re-render the same picker message with a new page
    if (data.startsWith('page:')) {
      page = parseInt(data.replace('page:', ''), 10);
      await update.answerCallbackQuery();
      await update.editMessageReplyMarkup({
        reply_markup: buildStorePicker(stores, lastVisits, page),
      });
      continue;
    }

    if (data === 'search:stores') {
      await update.answerCallbackQuery();
      await ctx.reply('Type part of the store name:');

      while (true) {
        const searchMsg = await conversation.wait();
        if (searchMsg.message?.text === '/cancel') {
          await ctx.reply("No worries — come back whenever you're ready 👋");
          return;
        }

        const term = searchMsg.message?.text?.trim();
        if (!term) continue;

        const market = ctx.user?.market ?? 'SG';
        const results = await conversation.external(() => searchStoresByName(market, term));

        if (results.length === 0) {
          await ctx.reply("No stores found — try a different search term.", {
            reply_markup: new InlineKeyboard()
              .text('← Back to my stores', 'search:back').row()
              .text('Cancel', 'cancel'),
          });
        } else {
          await ctx.reply('Pick a store:', {
            reply_markup: buildSearchResultsPicker(results),
          });
        }

        const pick = await conversation.wait();

        if (pick.message?.text === '/cancel') {
          await ctx.reply("No worries — come back whenever you're ready 👋");
          return;
        }
        if (!pick.callbackQuery) continue;

        const pickData = pick.callbackQuery.data ?? '';

        if (pickData === 'cancel') {
          await pick.answerCallbackQuery();
          await ctx.reply("No worries — come back whenever you're ready 👋");
          return;
        }
        if (pickData === 'search:back') {
          await pick.answerCallbackQuery();
          await ctx.reply('Which store did you visit?', {
            reply_markup: buildStorePicker(stores, lastVisits, page),
          });
          continue storeLoop;
        }

        if (pickData.startsWith('store:')) {
          storeId = pickData.replace('store:', '');
          const found = await conversation.external(() => getStoreById(storeId));
          if (!found) continue;
          storeName = found.name;
          await pick.answerCallbackQuery();
          break storeLoop;
        }
      }
    }

    if (data.startsWith('store:')) {
      storeId = data.replace('store:', '');
      const found = stores.find(s => s.id === storeId);
      if (found) {
        storeName = found.name;
      } else {
        const fetched = await conversation.external(() => getStoreById(storeId));
        if (!fetched) continue;
        storeName = fetched.name;
      }
      await update.answerCallbackQuery();
      break;
    }
  }

  // ── Consume active plan if any (silent) ───────────────────────────────────

  const plan = await conversation.external(() => getActivePlan(telegramId, storeId));

  // ── Step 2: Template ───────────────────────────────────────────────────────

  await ctx.reply(buildTemplateMessage(storeName), { parse_mode: 'MarkdownV2' });
  await ctx.reply(
    'Copy the template above, fill it in, and send it back\\. You can attach photos to the same message 📸\n/cancel to stop\\.',
    { parse_mode: 'MarkdownV2' },
  );

  // ── Step 3: Collect template text ─────────────────────────────────────────
  // Photos attached here are handled by the debounce handler after the
  // conversation exits — don't try to collect them inside the conversation.

  let templateText: string | null = null;
  let firstPhotoFileId: string | null = null;

  while (true) {
    const msg = await conversation.wait();

    // Handle "View full last visit" / "View visit" inline.
    // Global bot.callbackQuery handlers don't fire while a conversation is active.
    if (msg.callbackQuery) {
      const data = msg.callbackQuery.data ?? '';
      if (data.startsWith('viewlast:') || data.startsWith('viewvisit:')) {
        const visitId = data.replace(/^view(last|visit):/, '');
        await msg.answerCallbackQuery();
        await sendVisitDetails(msg, visitId);
      } else {
        await msg.answerCallbackQuery().catch(() => {});
      }
      continue;
    }

    if (msg.message?.text === '/cancel') {
      await ctx.reply('No worries — visit cancelled.');
      return;
    }

    const text = msg.message?.caption ?? msg.message?.text ?? null;
    if (!text) {
      await ctx.reply("Send the filled template as a text message. /cancel to stop.");
      continue;
    }

    // Capture photo 1 if template was sent as an album caption
    if (msg.message?.photo) {
      firstPhotoFileId = msg.message.photo[msg.message.photo.length - 1].file_id;
    }

    templateText = text;
    break;
  }

  // ── Step 4: Save and lock immediately ─────────────────────────────────────

  const sections = parseTemplate(templateText);
  const filled = filledCount(sections);

  const visit = await conversation.external(() =>
    createVisit({ store_id: storeId, cm_telegram_id: telegramId }),
  );

  if (!visit) {
    await ctx.reply("Something went wrong — give /visit another try 🙏");
    return;
  }

  await conversation.external(() => attachVisitSections(visit.id, sections));
  await conversation.external(() => lockVisit(visit.id));
  if (plan) await conversation.external(() => consumePlan(plan.id));

  // ── Hand off to debounce photo handler and exit ────────────────────────────
  // Photos from the same album are still arriving as separate Telegram updates.
  // The conversation exits here so they reach bot.on('message:photo') cleanly.

  startPhotoCollection(telegramId, visit.id, storeId, storeName, filled, firstPhotoFileId);

  const photoLine = firstPhotoFileId
    ? `\n\n📸 Photos received — saving them in the background\\.`
    : '';

  await ctx.reply(
    `🎉 *Done\\! ${storeName} is logged\\.* Nice work out there${photoLine}`,
    { parse_mode: 'MarkdownV2' },
  );
}
