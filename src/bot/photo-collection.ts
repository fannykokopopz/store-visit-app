import { Context } from 'grammy';
import { uploadVisitPhoto } from '../db/queries/photos.js';
import { config } from '../config.js';

interface PhotoCollection {
  visitId: string;
  storeId: string;
  storeName: string;
  sections: number;
  fileIds: string[];
  timer: NodeJS.Timeout | null;
}

// Process-level state — persists within Railway's single-process lifetime.
// Photo collection windows are short (<10s), so restart edge cases are acceptable.
const collections = new Map<number, PhotoCollection>();

export function startPhotoCollection(
  telegramId: number,
  visitId: string,
  storeId: string,
  storeName: string,
  sections: number,
): void {
  const existing = collections.get(telegramId);
  if (existing?.timer) clearTimeout(existing.timer);
  collections.set(telegramId, { visitId, storeId, storeName, sections, fileIds: [], timer: null });
}

export function isCollecting(telegramId: number): boolean {
  return collections.has(telegramId);
}

export async function handleIncomingPhoto(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const collection = collections.get(telegramId);
  if (!collection) return;
  if (collection.fileIds.length >= 6) return;

  const p = ctx.message?.photo;
  if (!p) return;

  collection.fileIds.push(p[p.length - 1].file_id);

  // Reset the 2-second debounce on every new photo
  if (collection.timer) clearTimeout(collection.timer);
  collection.timer = setTimeout(() => finalizeCollection(telegramId, ctx), 2000);
}

async function finalizeCollection(telegramId: number, ctx: Context): Promise<void> {
  const collection = collections.get(telegramId);
  if (!collection) return;
  collections.delete(telegramId);

  let uploaded = 0;
  for (const fileId of collection.fileIds) {
    try {
      const file = await ctx.api.getFile(fileId);
      const url = `https://api.telegram.org/file/bot${config.telegram.botToken}/${file.file_path}`;
      const resp = await fetch(url);
      const buffer = Buffer.from(await resp.arrayBuffer());
      const result = await uploadVisitPhoto(collection.visitId, buffer, collection.storeId);
      if (result) uploaded++;
    } catch (err) {
      console.error('[photos] upload error:', err);
    }
  }

  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const photoLine = uploaded > 0 ? `📸 ${uploaded} photo(s)` : '📸 No photos';
  const msg =
    `✅ *Visit locked — ${collection.storeName}*\n` +
    `📅 ${date}\n` +
    `📝 ${collection.sections}/5 sections filled\n` +
    photoLine;

  await ctx.api.sendMessage(telegramId, msg, { parse_mode: 'Markdown' });
}
