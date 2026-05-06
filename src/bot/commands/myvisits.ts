import { InlineKeyboard } from 'grammy';
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

  const keyboard = new InlineKeyboard();
  for (const v of visits) {
    const date = new Date(v.visit_date).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short',
    });
    keyboard.text(`📍 ${v.stores.name} — ${date}`, `viewvisit:${v.id}`).row();
  }

  await ctx.reply(`*Your last ${visits.length} visits:* (tap to view)`, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}
