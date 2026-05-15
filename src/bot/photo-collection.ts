import { Api, InlineKeyboard } from 'grammy';
import { uploadVisitPhoto } from '../db/queries/photos.js';
import { config } from '../config.js';
import { broadcastVisitLocked } from '../notifications/visit-broadcast.js';

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
  initialPhotoFileIds?: readonly string[] | string | null,
): void {
  const existing = collections.get(telegramId);
  if (existing?.timer) clearTimeout(existing.timer);

  let fileIds: string[];
  if (Array.isArray(initialPhotoFileIds)) {
    fileIds = initialPhotoFileIds.slice(0, 6);
  } else if (typeof initialPhotoFileIds === 'string') {
    fileIds = [initialPhotoFileIds];
  } else {
    fileIds = [];
  }

  const collection: PhotoCollection = { visitId, storeId, storeName, sections, fileIds, timer: null };
  collections.set(telegramId, collection);

  // Always start the debounce. If photos arrive they reset the timer;
  // if none come in 2s, finalize immediately with no photo line.
  collection.timer = setTimeout(() => finalizeCollection(telegramId), 2000);
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
  const meta: string[] = [`📅 ${date}`, `📝 ${collection.sections}/6 sections`];
  if (uploaded > 0) meta.push(`📸 ${uploaded} photo${uploaded === 1 ? '' : 's'}`);

  const text =
    `🏪 *${collection.storeName}*\n` +
    `${meta.join('  ·  ')}\n\n` +
    `_Looks good? Confirm to lock it in — or edit if something's off._`;

  await botApi.sendMessage(telegramId, text, {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard()
      .text('✅ Confirm', `confirm_visit:${collection.visitId}`).row()
      .text('✏️ Edit', `edit:${collection.visitId}`)
      .text('🗑️ Delete', `delete:${collection.visitId}`),
  });

  // Broadcast to the group chat — fires after photos are uploaded so the
  // deep-linked visit detail page renders with photos already in place.
  // Failure here must not affect the visit — broadcast helper handles its own errors.
  await broadcastVisitLocked(collection.visitId, botApi);
}
