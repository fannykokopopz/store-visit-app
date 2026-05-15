import { Api } from 'grammy';
import { uploadVisitPhoto } from '../db/queries/photos.js';
import { config } from '../config.js';

interface PhotoCollection {
  visitId: string;
  storeId: string;
  storeName: string;
  sections: number;
  fileIds: string[];
  timer: NodeJS.Timeout | null;
  resolveDone: (n: number) => void;
}

// Process-level state — persists within Railway's single-process lifetime.
const collections = new Map<number, PhotoCollection>();
// Keyed by visitId so awaiters can read the saved count even after the
// active collection has been deleted on finalize.
const pendingResults = new Map<string, Promise<number>>();

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

  let resolveDone!: (n: number) => void;
  const done = new Promise<number>((r) => { resolveDone = r; });
  pendingResults.set(visitId, done);

  const collection: PhotoCollection = {
    visitId, storeId, storeName, sections, fileIds, timer: null, resolveDone,
  };
  collections.set(telegramId, collection);

  // Always start the debounce. If photos arrive they reset the timer;
  // if none come in 2s, finalize immediately.
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

// Awaited by the visit conversation right before the Done message,
// so the final reply can include the saved count instead of a stray
// follow-up arriving later.
export async function awaitPhotoUpload(visitId: string): Promise<number> {
  const p = pendingResults.get(visitId);
  if (!p) return 0;
  const saved = await p;
  pendingResults.delete(visitId);
  return saved;
}

async function finalizeCollection(telegramId: number): Promise<void> {
  const collection = collections.get(telegramId);
  if (!collection) return;
  collections.delete(telegramId);

  if (!botApi) {
    console.error('[photos] botApi not initialized — call initPhotoCollection(bot.api) at startup');
    collection.resolveDone(0);
    return;
  }

  let saved = 0;
  for (const fileId of collection.fileIds) {
    try {
      const file = await botApi.getFile(fileId);
      const url = `https://api.telegram.org/file/bot${config.telegram.botToken}/${file.file_path}`;
      const resp = await fetch(url);
      const buffer = Buffer.from(await resp.arrayBuffer());
      await uploadVisitPhoto(collection.visitId, buffer, collection.storeId);
      saved++;
    } catch (err) {
      console.error('[photos] upload error:', err);
    }
  }

  collection.resolveDone(saved);
}
