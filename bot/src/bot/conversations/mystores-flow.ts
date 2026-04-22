import { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { BotContext } from '../middleware/auth.js';
import { getStoresForUser, Store } from '../../db/queries/stores.js';
import { getStoreVisitStats } from '../../db/queries/visits.js';
import { handleStaffList } from '../shared/staff-management.js';

type MyStoresConversation = Conversation<BotContext, BotContext>;

export async function myStoresFlow(conversation: MyStoresConversation, ctx: BotContext): Promise<void> {
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

  const stores = await conversation.external(() => getStoresForUser(user.id));
  if (stores.length === 0) {
    await ctx.reply("Looks like you don't have any stores assigned yet. Check with your manager!");
    return;
  }

  const allStats = await conversation.external(async () => {
    const results: Record<string, Awaited<ReturnType<typeof getStoreVisitStats>>> = {};
    await Promise.all(
      stores.map(async (s) => {
        results[s.id] = await getStoreVisitStats(s.id, user.id);
      }),
    );
    return results;
  });

  let msg = '📍 *Your Stores*\n\n';
  for (let i = 0; i < stores.length; i++) {
    const s = stores[i];
    const stats = allStats[s.id];

    let lastVisitLabel: string;
    if (stats.daysSinceLastVisit === null) {
      lastVisitLabel = 'Not visited yet';
    } else if (stats.daysSinceLastVisit === 0) {
      lastVisitLabel = 'Today';
    } else if (stats.daysSinceLastVisit === 1) {
      lastVisitLabel = '1 day ago';
    } else {
      lastVisitLabel = `${stats.daysSinceLastVisit}d ago`;
    }

    msg += `*${i + 1}.* ${s.name}\n`;
    msg += `    📅 ${lastVisitLabel} · 🔄 ${stats.visitsThisMonth} this mo · 👥 ${stats.staffCount}\n\n`;
  }

  msg += 'Type a number to see more about a store, or /cancel to go back.';
  await ctx.reply(msg, { parse_mode: 'Markdown' });

  await storePickLoop(conversation, ctx, stores, user.id);
}

async function storePickLoop(
  conversation: MyStoresConversation,
  ctx: BotContext,
  stores: Store[],
  userId: string,
): Promise<void> {
  const response = await conversation.wait();
  const text = response.message?.text?.trim();

  if (!text || text === '/cancel') return;

  const num = parseInt(text.replace(/^\//, ''), 10);
  if (isNaN(num) || num < 1 || num > stores.length) {
    await ctx.reply(`Pick a number between 1 and ${stores.length}, or /cancel.`);
    return storePickLoop(conversation, ctx, stores, userId);
  }

  const store = stores[num - 1];
  await showStoreDetail(conversation, ctx, store, userId);

  const allStats = await conversation.external(async () => {
    const results: Record<string, Awaited<ReturnType<typeof getStoreVisitStats>>> = {};
    await Promise.all(
      stores.map(async (s) => {
        results[s.id] = await getStoreVisitStats(s.id, userId);
      }),
    );
    return results;
  });

  let msg = '📍 *Your Stores*\n\n';
  for (let i = 0; i < stores.length; i++) {
    const s = stores[i];
    const stats = allStats[s.id];

    let lastVisitLabel: string;
    if (stats.daysSinceLastVisit === null) {
      lastVisitLabel = 'Not visited yet';
    } else if (stats.daysSinceLastVisit === 0) {
      lastVisitLabel = 'Today';
    } else if (stats.daysSinceLastVisit === 1) {
      lastVisitLabel = '1 day ago';
    } else {
      lastVisitLabel = `${stats.daysSinceLastVisit}d ago`;
    }

    msg += `*${i + 1}.* ${s.name}\n`;
    msg += `    📅 ${lastVisitLabel} · 🔄 ${stats.visitsThisMonth} this mo · 👥 ${stats.staffCount}\n\n`;
  }

  msg += 'Type a number to see more about a store, or /cancel to go back.';
  await ctx.reply(msg, { parse_mode: 'Markdown' });

  return storePickLoop(conversation, ctx, stores, userId);
}

async function showStoreDetail(
  conversation: MyStoresConversation,
  ctx: BotContext,
  store: Store,
  userId: string,
): Promise<void> {
  const stats = await conversation.external(() => getStoreVisitStats(store.id, userId));

  let daysLabel: string;
  if (stats.daysSinceLastVisit === null) {
    daysLabel = 'Not visited yet';
  } else if (stats.daysSinceLastVisit === 0) {
    daysLabel = 'Today';
  } else if (stats.daysSinceLastVisit === 1) {
    daysLabel = '1 day ago';
  } else {
    daysLabel = `${stats.daysSinceLastVisit} days ago`;
  }

  const msg =
    `🏪 *${store.name}*\n` +
    `${store.chain} · ${store.tier}\n\n` +
    `📅 Last visit: ${daysLabel}\n` +
    `🔄 ${stats.visitsThisMonth} visit${stats.visitsThisMonth === 1 ? '' : 's'} this month\n` +
    `👥 ${stats.staffCount} staff on record\n` +
    `📋 ${stats.trainingsThisQuarter} training${stats.trainingsThisQuarter === 1 ? '' : 's'} this quarter`;

  await ctx.reply(msg, {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard()
      .text('👥 View staff list', 'storedetail:staff').row()
      .text('← Back', 'storedetail:back'),
  });

  const response = await conversation.wait();
  const data = response.callbackQuery?.data;
  if (response.callbackQuery) await response.answerCallbackQuery();

  if (data === 'storedetail:staff') {
    await handleStaffList(conversation, ctx, store.id);
  }
}
