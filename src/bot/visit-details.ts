import { Context, InputMediaBuilder } from 'grammy';
import { getFullVisit } from '../db/queries/visits.js';
import { getPhotosForVisit, signPhotoUrls } from '../db/queries/photos.js';
import { listFollowUpsForVisit } from '../db/queries/visit-follow-ups.js';

// V2 order: 4 prompts. Legacy buzz_plan kept at the end so old visits still
// render anything they had there. follow_up freetext rendered only when no
// structured visit_follow_ups rows exist (the structured list supersedes it).
const SECTION_DEFS: Array<{
  key: 'good_news' | 'people_training' | 'competitors' | 'display_stock' | 'buzz_plan';
  label: string;
  emoji: string;
}> = [
  { key: 'good_news',       label: 'Good News',           emoji: '🎉' },
  { key: 'people_training', label: 'People & Training',   emoji: '👥' },
  { key: 'competitors',     label: 'Competitor Insights', emoji: '🔍' },
  { key: 'display_stock',   label: 'Display & Stock',     emoji: '📦' },
  { key: 'buzz_plan',       label: 'Buzz Plan',           emoji: '⚡' },
];

const TG_CAPTION_LIMIT = 1000; // Telegram caps at 1024; leave headroom for markdown overhead

export async function sendVisitDetails(ctx: Context, visitId: string): Promise<void> {
  const visit = await getFullVisit(visitId);
  if (!visit) {
    await ctx.reply("Couldn't find that visit.");
    return;
  }
  if (visit.cm_telegram_id !== ctx.from?.id) {
    await ctx.reply("You don't have access to that visit.");
    return;
  }

  const [photos, followUps] = await Promise.all([
    getPhotosForVisit(visitId),
    listFollowUpsForVisit(visitId),
  ]);
  const photoUrls =
    photos.length > 0
      ? await signPhotoUrls(photos.map((p) => p.storage_path))
      : [];

  const date = new Date(visit.visit_date).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const lines: string[] = [`🏪 *${visit.store_name}*`, `📅 ${date}`, ''];
  let anyFilled = false;
  for (const { key, label, emoji } of SECTION_DEFS) {
    const val = visit[key];
    if (val) {
      anyFilled = true;
      lines.push(`${emoji} *${label}*`, val, '');
    }
  }

  if (followUps.length > 0) {
    anyFilled = true;
    const openCount = followUps.filter((f) => f.status === 'open').length;
    lines.push(`✅ *Follow-ups (${openCount} open)*`);
    for (const f of followUps) {
      const box = f.status === 'done' ? '☑' : '☐';
      const due = f.due_date ? ` · ${f.due_date}` : '';
      lines.push(`${box} ${f.title}${due}`);
    }
    lines.push('');
  } else if (visit.follow_up) {
    anyFilled = true;
    lines.push('✅ *Follow-up*', visit.follow_up, '');
  }

  if (!anyFilled) lines.push('_No notes were added for this visit._');

  // If photos exist but signing failed, show count so user knows they're there
  if (photos.length > 0 && photoUrls.length === 0) {
    lines.push('', `📸 ${photos.length} photo(s) (preview unavailable)`);
  }

  const text = lines.join('\n').trimEnd();

  // No photos to send → text only
  if (photoUrls.length === 0) {
    await ctx.reply(text, { parse_mode: 'Markdown' });
    return;
  }

  const captionFits = text.length <= TG_CAPTION_LIMIT;

  // Caption too long → text separately, photos with no caption
  if (!captionFits) {
    await ctx.reply(text, { parse_mode: 'Markdown' });
    if (photoUrls.length === 1) {
      await ctx.replyWithPhoto(photoUrls[0]);
    } else {
      await ctx.replyWithMediaGroup(
        photoUrls.map((url) => InputMediaBuilder.photo(url)),
      );
    }
    return;
  }

  // Caption fits → attach to photo(s), same shape as original submission
  if (photoUrls.length === 1) {
    await ctx.replyWithPhoto(photoUrls[0], {
      caption: text,
      parse_mode: 'Markdown',
    });
  } else {
    await ctx.replyWithMediaGroup(
      photoUrls.map((url, i) =>
        i === 0
          ? InputMediaBuilder.photo(url, { caption: text, parse_mode: 'Markdown' })
          : InputMediaBuilder.photo(url),
      ),
    );
  }
}
