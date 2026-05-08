import { InlineKeyboard } from 'grammy';
import { Store } from '../../db/queries/stores.js';

export const STORE_PAGE_SIZE = 6;

function daysSince(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function lastVisitLabel(storeId: string, lastVisits: Record<string, string>): string {
  const date = lastVisits[storeId];
  if (!date) return 'never visited';
  const days = daysSince(date);
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

function statusIcon(storeId: string, lastVisits: Record<string, string>): string {
  const date = lastVisits[storeId];
  if (!date) return '⚪';
  const days = daysSince(date);
  if (days <= 1) return '✅';
  if (days <= 7) return '🟢';
  return '🟡';
}

export function buildStoreContextMessage(
  stores: Store[],
  lastVisits: Record<string, string> = {},
): string {
  const lines = stores.map(s => {
    const icon = statusIcon(s.id, lastVisits);
    const label = lastVisitLabel(s.id, lastVisits);
    return `${icon} ${s.name} · ${label}`;
  });
  return `🏪 Your stores\n\n${lines.join('\n')}`;
}

export function buildStorePicker(
  stores: Store[],
  lastVisits: Record<string, string> = {},
  page = 0,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  const totalPages = Math.ceil(stores.length / STORE_PAGE_SIZE);
  const pageStores = stores.slice(page * STORE_PAGE_SIZE, (page + 1) * STORE_PAGE_SIZE);

  for (const store of pageStores) {
    kb.text(store.name, `store:${store.id}`).row();
  }

  if (totalPages > 1) {
    const prevBtn = page > 0;
    const nextBtn = page < totalPages - 1;
    if (prevBtn && nextBtn) {
      kb.text('← Back', `page:${page - 1}`).text(`Next →`, `page:${page + 1}`).row();
    } else if (prevBtn) {
      kb.text('← Back', `page:${page - 1}`).row();
    } else if (nextBtn) {
      kb.text(`Next →`, `page:${page + 1}`).row();
    }
  }

  kb.text('🔍 Other store', 'search:stores').row();
  kb.text('Cancel', 'cancel').row();
  return kb;
}

export function buildSearchResultsPicker(stores: Store[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const store of stores) {
    kb.text(store.name, `store:${store.id}`).row();
  }
  kb.text('← Back', 'search:back').row();
  kb.text('Cancel', 'cancel').row();
  return kb;
}

export function buildStaffPicker(
  staffList: Array<{ id: string; name: string; role: string | null; is_ally: boolean }>,
  selected: Set<string>,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const s of staffList) {
    const tick = selected.has(s.id) ? '✅ ' : '';
    const ally = s.is_ally ? ' ⭐' : '';
    kb.text(`${tick}${s.name}${ally}`, `staff:toggle:${s.id}`).row();
  }
  kb.text('+ Add new staff', 'staff:add').row();
  kb.text('Done', 'staff:done').row();
  return kb;
}
