import { BotContext, requireAuth } from '../middleware/auth.js';
import { getStoresForCM } from '../../db/queries/stores.js';
import { getLastVisitDatePerStore } from '../../db/queries/visits.js';
import { daysSinceLabel } from '../../utils/format.js';

export async function handleMyStores(ctx: BotContext): Promise<void> {
  const user = requireAuth(ctx);
  if (!user) return;

  const stores = await getStoresForCM(user.telegram_id);
  if (stores.length === 0) {
    await ctx.reply("No stores assigned to you yet. Ask your manager to set this up.");
    return;
  }

  const lastVisits = await getLastVisitDatePerStore(user.telegram_id);

  let message = '📋 *Your Store Portfolio*\n';

  for (const store of stores) {
    const lastDate = lastVisits[store.id] ?? null;
    message += `\n⚪ *${store.name}*`;
    if (store.tier) message += ` (${store.tier})`;
    message += `\n   ${daysSinceLabel(lastDate)}\n`;
  }

  message += '\nTap /visit to log a visit.';

  await ctx.reply(message, { parse_mode: 'Markdown' });
}
