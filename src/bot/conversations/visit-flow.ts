import { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { BotContext } from '../middleware/auth.js';
import { getStoresForCM } from '../../db/queries/stores.js';
import { searchStoresByName, getStoreById } from '../../db/queries/stores.js';
import { createVisit, lockVisit, attachVisitSections, getLastVisitDatePerStore, getStoreContextForCM } from '../../db/queries/visits.js';
import { getActivePlan, consumePlan } from '../../db/queries/visit-plans.js';
import { buildStorePicker, buildSearchResultsPicker } from '../keyboards/store-picker.js';
import { buildTemplateMessage } from '../../utils/template.js';
import { parseTemplate, filledCount } from '../../utils/parse-template.js';
import { daysSinceLabel } from '../../utils/format.js';
import { startPhotoCollection } from '../photo-collection.js';

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
    await ctx.reply("You don't have any stores assigned. Contact your admin.");
    return;
  }

  await ctx.reply('Which store did you visit?', {
    reply_markup: buildStorePicker(stores, lastVisits),
  });

  let storeId = '';
  let storeName = '';

  storeLoop: while (true) {
    const response = await conversation.waitForCallbackQuery(/^(store:|search:|cancel$)/);
    const data = response.callbackQuery.data;

    if (data === 'cancel') {
      await response.answerCallbackQuery();
      await ctx.reply('Visit cancelled.');
      return;
    }

    if (data === 'search:stores') {
      await response.answerCallbackQuery();
      await ctx.reply('Type part of the store name:');

      while (true) {
        const searchMsg = await conversation.wait();
        if (searchMsg.message?.text === '/cancel') {
          await ctx.reply('Visit cancelled.');
          return;
        }

        const term = searchMsg.message?.text?.trim();
        if (!term) continue;

        const results = await conversation.external(() => searchStoresByName('SG', term));

        if (results.length === 0) {
          await ctx.reply('No stores found. Try a different name.', {
            reply_markup: new InlineKeyboard()
              .text('← Back to my stores', 'search:back').row()
              .text('Cancel', 'cancel'),
          });
        } else {
          await ctx.reply('Select a store:', {
            reply_markup: buildSearchResultsPicker(results),
          });
        }

        const pick = await conversation.waitForCallbackQuery(/^(store:|search:back|cancel$)/);

        if (pick.callbackQuery.data === 'cancel') {
          await pick.answerCallbackQuery();
          await ctx.reply('Visit cancelled.');
          return;
        }
        if (pick.callbackQuery.data === 'search:back') {
          await pick.answerCallbackQuery();
          await ctx.reply('Which store did you visit?', {
            reply_markup: buildStorePicker(stores, lastVisits),
          });
          continue storeLoop;
        }

        storeId = pick.callbackQuery.data.replace('store:', '');
        const found = await conversation.external(() => getStoreById(storeId));
        if (!found) continue;
        storeName = found.name;
        await pick.answerCallbackQuery();
        break storeLoop;
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
      await response.answerCallbackQuery();
      break;
    }
  }

  // ── Pre-visit context: last visit + 30d count ─────────────────────────────

  const storeTier = stores.find((s) => s.id === storeId)?.tier ?? null;
  const storeContext = await conversation.external(() =>
    getStoreContextForCM(telegramId, storeId),
  );

  const tierBadge = storeTier ? ` (${storeTier})` : '';
  if (!storeContext.lastVisitDate) {
    await ctx.reply(
      `📍 *${storeName}*${tierBadge}\n✨ First visit to this store`,
      { parse_mode: 'Markdown' },
    );
  } else {
    const lastFmt = new Date(storeContext.lastVisitDate).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short',
    });
    const ago = daysSinceLabel(storeContext.lastVisitDate).toLowerCase();
    const block =
      `📍 *${storeName}*${tierBadge}\n` +
      `🕐 Last visit: ${ago} (${lastFmt})\n` +
      `📊 ${storeContext.last30dCount} visit${storeContext.last30dCount === 1 ? '' : 's'} in the last 30 days`;
    const replyMarkup = storeContext.lastVisitId
      ? new InlineKeyboard().text('📋 View full last visit', `viewlast:${storeContext.lastVisitId}`)
      : undefined;
    await ctx.reply(block, { parse_mode: 'Markdown', reply_markup: replyMarkup });
  }

  // ── Show active plan if any ────────────────────────────────────────────────

  const plan = await conversation.external(() => getActivePlan(telegramId, storeId));
  if (plan) {
    let planMsg = `📋 *Your plan for ${storeName}:*\n`;
    if (plan.buzz_plan) planMsg += `💡 ${plan.buzz_plan}\n`;
    if (plan.notes) planMsg += `📝 ${plan.notes}`;
    await ctx.reply(planMsg.trim(), { parse_mode: 'Markdown' });
  }

  // ── Step 2: Template ───────────────────────────────────────────────────────

  await ctx.reply(buildTemplateMessage(storeName), { parse_mode: 'MarkdownV2' });
  await ctx.reply(
    'Fill in the template and send it back\\. Attach photos to the same message \\(album is fine\\)\\.\nType /cancel to abort\\.',
    { parse_mode: 'MarkdownV2' },
  );

  // ── Step 3: Collect template text ─────────────────────────────────────────
  // Photos attached here are handled by the debounce handler after the
  // conversation exits — don't try to collect them inside the conversation.

  let templateText: string | null = null;
  let firstPhotoFileId: string | null = null;

  while (true) {
    const msg = await conversation.wait();

    if (msg.message?.text === '/cancel') {
      await ctx.reply('Visit cancelled.');
      return;
    }

    const text = msg.message?.caption ?? msg.message?.text ?? null;
    if (!text) {
      await ctx.reply('Please send your filled template as text. Type /cancel to abort.');
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
    await ctx.reply('Something went wrong saving your visit. Please try /visit again.');
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
    ? `\n\n📸 Photos received — saving in the background\\. Confirmation coming shortly\\.`
    : '';

  await ctx.reply(
    `📝 *Notes locked — ${storeName}*${photoLine}`,
    { parse_mode: 'MarkdownV2' },
  );
}
