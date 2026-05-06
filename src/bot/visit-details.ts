import { Context, InputMediaBuilder } from 'grammy';
import { getFullVisit } from '../db/queries/visits.js';
import { getPhotosForVisit, signPhotoUrls } from '../db/queries/photos.js';

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

const TG_CAPTION_LIMIT = 1000; // Telegram caps at 1024; leave headroom for markdown overhead

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
  const photoUrls =
    photos.length > 0
      ? await signPhotoUrls(photos.map((p) => p.storage_path))
      : [];

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
  if (!anyFilled) lines.push('_No notes filled in for this visit._');

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
