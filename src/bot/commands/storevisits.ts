import { InlineKeyboard } from 'grammy';
import { BotContext, requireAuth } from '../middleware/auth.js';
import { getStoresForCM, getStoreById } from '../../db/queries/stores.js';
import { getVisitsByCMAndStore } from '../../db/queries/visits.js';

export async function handleStoreVisits(ctx: BotContext): Promise<void> {
  const user = requireAuth(ctx);
  if (!user) return;

  const stores = await getStoresForCM(user.telegram_id);
  if (stores.length === 0) {
    await ctx.reply("You don't have any stores assigned. Contact your admin.");
    return;
  }

  const keyboard = new InlineKeyboard();
  for (const store of stores) {
    const tier = store.tier ? ` (${store.tier})` : '';
    keyboard.text(`📍 ${store.name}${tier}`, `svstore:${store.id}`).row();
  }

  await ctx.reply('*Pick a store to see your visits:*', {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

export async function handleStoreVisitsPicked(
  ctx: BotContext,
  storeId: string,
): Promise<void> {
  const user = requireAuth(ctx);
  if (!user) return;

  const [store, visits] = await Promise.all([
    getStoreById(storeId),
    getVisitsByCMAndStore(user.telegram_id, storeId, 20),
  ]);

  if (!store) {
    await ctx.reply('Store not found.');
    return;
  }

  if (visits.length === 0) {
    await ctx.reply(
      `No visits logged at *${store.name}* yet.\nUse /visit to log one.`,
      { parse_mode: 'Markdown' },
    );
    return;
  }

  const keyboard = new InlineKeyboard();
  for (const v of visits) {
    const date = new Date(v.visit_date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
    });
    keyboard.text(`📅 ${date}`, `viewvisit:${v.id}`).row();
  }

  const tier = store.tier ? ` (${store.tier})` : '';
  await ctx.reply(
    `*${store.name}${tier}* — ${visits.length} visit${visits.length === 1 ? '' : 's'} (tap to view):`,
    { parse_mode: 'Markdown', reply_markup: keyboard },
  );
}
