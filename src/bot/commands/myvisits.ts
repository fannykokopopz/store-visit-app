import { BotContext } from '../middleware/auth.js';
import { requireAuth } from '../middleware/auth.js';
import { getRecentVisitsByCM } from '../../db/queries/visits.js';

export async function handleMyVisits(ctx: BotContext): Promise<void> {
  const user = requireAuth(ctx);
  if (!user) return;

  const visits = await getRecentVisitsByCM(user.telegram_id, 5);

  if (visits.length === 0) {
    await ctx.reply('No visits logged yet. Use /visit to log one.');
    return;
  }

  const lines = visits.map((v) => {
    const date = new Date(v.visit_date).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short',
    });
    return `📍 *${v.stores.name}* — ${date}`;
  });

  await ctx.reply(
    `*Your last ${visits.length} visits:*\n\n${lines.join('\n')}`,
    { parse_mode: 'Markdown' },
  );
}
