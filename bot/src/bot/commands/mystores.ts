import { BotContext, requireAuth } from '../middleware/auth.js';
import { getStoresForUser } from '../../db/queries/stores.js';
import { getLatestVisitPerStore } from '../../db/queries/visits.js';
import { healthEmoji, momentumEmoji, daysSinceLabel } from '../../utils/format.js';

export async function handleMyStores(ctx: BotContext): Promise<void> {
  const user = requireAuth(ctx);
  if (!user) return;

  const stores = await getStoresForUser(user.id);
  if (stores.length === 0) {
    await ctx.reply("Looks like you don't have any stores assigned yet. Check with your manager!");
    return;
  }

  const latestVisits = await getLatestVisitPerStore(user.id);
  const visitMap = new Map(latestVisits.map(v => [v.store_id, v]));

  let message = '📍 *Your Stores*\n';

  for (const store of stores) {
    const visit = visitMap.get(store.id);
    message += '\n';

    if (visit?.overall_health) {
      message += `${healthEmoji(visit.overall_health)} *${store.name}*\n`;
      message += `   ${momentumEmoji(visit.momentum)} ${visit.key_insight || 'No insight yet'}\n`;
    } else {
      message += `⚪ *${store.name}*\n`;
      if (visit) {
        const hasNotes = visit.visit_notes || visit.raw_notes_combined;
        message += `   ${hasNotes ? 'Notes on file' : 'No notes yet'}\n`;
      } else {
        message += `   Not visited yet\n`;
      }
    }

    message += `   ${daysSinceLabel(visit?.visit_date ?? null)}\n`;
  }

  message += '\nReady to log a visit? Just type /visit';

  await ctx.reply(message, { parse_mode: 'Markdown' });
}
