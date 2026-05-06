import { Context } from 'grammy';
import { getFullVisit } from '../db/queries/visits.js';
import { getPhotosForVisit } from '../db/queries/photos.js';

const SECTION_DEFS: Array<{
  key: 'good_news' | 'competitors' | 'display_stock' | 'follow_up' | 'buzz_plan';
  label: string;
  emoji: string;
}> = [
  { key: 'good_news',     label: 'Good News',              emoji: '1️⃣' },
  { key: 'competitors',   label: "Competitors' Insights",  emoji: '2️⃣' },
  { key: 'display_stock', label: 'Display & Stock',        emoji: '3️⃣' },
  { key: 'follow_up',     label: 'What to Follow Up',      emoji: '4️⃣' },
  { key: 'buzz_plan',     label: 'Buzz Plan',              emoji: '5️⃣' },
];

export async function sendVisitDetails(ctx: Context, visitId: string): Promise<void> {
  const visit = await getFullVisit(visitId);
  if (!visit) {
    await ctx.reply('Visit not found.');
    return;
  }
  if (visit.cm_telegram_id !== ctx.from?.id) {
    await ctx.reply("That's not your visit.");
    return;
  }

  const photos = await getPhotosForVisit(visitId);
  const date = new Date(visit.visit_date).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const lines: string[] = [`📋 *${visit.store_name} — ${date}*`, ''];

  let anyFilled = false;
  for (const { key, label, emoji } of SECTION_DEFS) {
    const val = visit[key];
    if (val) {
      anyFilled = true;
      lines.push(`${emoji} *${label}*`, val, '');
    }
  }

  if (!anyFilled) lines.push('_No notes filled in for this visit._', '');

  if (photos.length > 0) {
    lines.push(`📸 ${photos.length} photo(s)`);
  }

  await ctx.reply(lines.join('\n').trimEnd(), { parse_mode: 'Markdown' });
}
