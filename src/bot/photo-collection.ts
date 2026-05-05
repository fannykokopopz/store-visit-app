import { Api, InlineKeyboard } from 'grammy';
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
const collections = new Map<number, PhotoCollection>();

// Set once at startup via initPhotoCollection(bot.api).
// Using bot.api directly avoids the grammY conversation replay wrapper,
// which throws if you call ctx.api after a conversation has exited.
let botApi: Api | undefined;

export function initPhotoCollection(api: Api): void {
  botApi = api;
}

export function startPhotoCollection(
  telegramId: number,
  visitId: string,
  storeId: string,
  storeName: string,
  sections: number,
  firstPhotoFileId?: string | null,
): void {
  const existing = collections.get(telegramId);
  if (existing?.timer) clearTimeout(existing.timer);
  const fileIds = firstPhotoFileId ? [firstPhotoFileId] : [];
  const collection: PhotoCollection = { visitId, storeId, storeName, sections, fileIds, timer: null };
  collections.set(telegramId, collection);

  // If photo 1 arrived with the caption, start debounce now.
  // Subsequent album photos will reset it via handleIncomingPhoto.
  if (firstPhotoFileId) {
    collection.timer = setTimeout(() => finalizeCollection(telegramId), 2000);
  }
}

export function isCollecting(telegramId: number): boolean {
  return collections.has(telegramId);
}

export async function handleIncomingPhoto(telegramId: number, fileId: string): Promise<void> {
  const collection = collections.get(telegramId);
  if (!collection) return;
  if (collection.fileIds.length >= 6) return;

  collection.fileIds.push(fileId);

  if (collection.timer) clearTimeout(collection.timer);
  collection.timer = setTimeout(() => finalizeCollection(telegramId), 2000);
}

async function finalizeCollection(telegramId: number): Promise<void> {
  const collection = collections.get(telegramId);
  if (!collection) return;
  collections.delete(telegramId);

  if (!botApi) {
    console.error('[photos] botApi not initialized — call initPhotoCollection(bot.api) at startup');
    return;
  }

  let uploaded = 0;
  for (const fileId of collection.fileIds) {
    try {
      const file = await botApi.getFile(fileId);
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
  const lines = [
    `📋 *Visit log — ${collection.storeName}*`,
    `📅 ${date}`,
    `📝 ${collection.sections}/5 sections filled`,
  ];
  if (uploaded > 0) lines.push(`📸 ${uploaded} photo(s)`);

  await botApi.sendMessage(telegramId, lines.join('\n'), {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard()
      .text('✅ Confirm', `confirm_visit:${collection.visitId}`).row()
      .text('✏️ Edit notes', `edit:${collection.visitId}`)
      .text('🗑️ Delete', `delete:${collection.visitId}`),
  });
}
