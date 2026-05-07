import { InlineKeyboard } from 'grammy';
import { BotContext, requireAuth } from '../middleware/auth.js';
import { getStoresForCM } from '../../db/queries/stores.js';
import { getLastVisitDatePerStore, getRecentVisitsByCM } from '../../db/queries/visits.js';
import { daysSince, daysSinceLabel } from '../../utils/format.js';

const OVERDUE_DAYS: Record<string, number> = {
  T1: 7,
  T2: 14,
  T3: 30,
  T4: 90,
};

const TIER_EMOJI: Record<string, string> = {
  T1: '🔵',
  T2: '🟢',
  T3: '🟡',
  T4: '⚪',
};

export async function buildProfileContent(telegramId: number, user: NonNullable<BotContext['user']>) {
  const [stores, lastVisits] = await Promise.all([
    getStoresForCM(telegramId),
    getLastVisitDatePerStore(telegramId),
  ]);

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let visitedThisMonth = 0;
  let overdue = 0;

  for (const store of stores) {
    const lastDate = lastVisits[store.id] ?? null;
    if (lastDate) {
      if (lastDate >= since30) visitedThisMonth++;
      const threshold = store.tier ? (OVERDUE_DAYS[store.tier] ?? 14) : 14;
      const d = daysSince(lastDate);
      if (d !== null && d > threshold) overdue++;
    } else if (store.tier === 'T1' || store.tier === 'T2') {
      overdue++;
    }
  }

  const firstName = user.full_name.split(' ')[0];
  let text = `👤 *${firstName}*\n${user.role.toUpperCase()} · ${user.market} · ${stores.length} store${stores.length === 1 ? '' : 's'}\n\n`;

  if (stores.length === 0) {
    text += `_No stores assigned yet. Ask your manager to set this up._`;
  } else {
    if (visitedThisMonth > 0) text += `✅ ${visitedThisMonth} visited this month\n`;
    if (overdue > 0) text += `⚠️ ${overdue} overdue\n`;
    if (visitedThisMonth === 0 && overdue === 0) text += `_No visits logged yet — tap /visit to get started._\n`;
  }

  const keyboard = new InlineKeyboard();
  if (stores.length > 0) {
    keyboard.text('📋 My Stores', 'profile:stores').text('🗓 Recent Visits', 'profile:visits');
  }

  return { text, keyboard, stores, lastVisits };
}

export async function handleMyProfile(ctx: BotContext): Promise<void> {
  const user = requireAuth(ctx);
  if (!user) return;

  const { text, keyboard } = await buildProfileContent(user.telegram_id, user);
  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

export async function handleProfileStores(ctx: BotContext): Promise<void> {
  const user = requireAuth(ctx);
  if (!user) return;

  const [stores, lastVisits] = await Promise.all([
    getStoresForCM(user.telegram_id),
    getLastVisitDatePerStore(user.telegram_id),
  ]);

  await ctx.answerCallbackQuery();

  let text = `📋 *Your Stores*\n\n`;
  for (const store of stores) {
    const lastDate = lastVisits[store.id] ?? null;
    const tierEmoji = store.tier ? (TIER_EMOJI[store.tier] ?? '⚪') : '⚪';
    const tier = store.tier ? ` _(${store.tier})_` : '';
    text += `${tierEmoji} *${store.name}*${tier}\n   ${daysSinceLabel(lastDate)}\n`;
  }
  text += `\nTap /visit to log a visit.`;

  const keyboard = new InlineKeyboard().text('← Back', 'profile:back');
  await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

export async function handleProfileVisits(ctx: BotContext): Promise<void> {
  const user = requireAuth(ctx);
  if (!user) return;

  const visits = await getRecentVisitsByCM(user.telegram_id, 5);
  await ctx.answerCallbackQuery();

  if (visits.length === 0) {
    const keyboard = new InlineKeyboard().text('← Back', 'profile:back');
    await ctx.editMessageText(
      `🗓 *Recent Visits*\n\n_Nothing here yet. Use /visit to log your first visit._`,
      { parse_mode: 'Markdown', reply_markup: keyboard },
    );
    return;
  }

  let text = `🗓 *Recent Visits*\n\n`;
  const keyboard = new InlineKeyboard();

  for (const v of visits) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = v as any;
    const date = new Date(row.visit_date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    });
    text += `📍 *${row.stores.name}* — ${date}\n`;
    keyboard.text(`📅 ${row.stores.name} — ${date}`, `viewvisit:${row.id}`).row();
  }

  keyboard.row().text('← Back', 'profile:back');
  await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

export async function handleProfileBack(ctx: BotContext): Promise<void> {
  const user = requireAuth(ctx);
  if (!user) return;

  const { text, keyboard } = await buildProfileContent(user.telegram_id, user);
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}
