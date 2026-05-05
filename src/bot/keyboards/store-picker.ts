import { InlineKeyboard } from 'grammy';
import { Store } from '../../db/queries/stores.js';

function daysSince(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function lastVisitLabel(storeId: string, lastVisits: Record<string, string>): string {
  const date = lastVisits[storeId];
  if (!date) return 'never visited';
  const days = daysSince(date);
  if (days === 0) return 'visited today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

export function buildStorePicker(
  stores: Store[],
  lastVisits: Record<string, string> = {},
): InlineKeyboard {
  const kb = new InlineKeyboard();

  for (const store of stores) {
    const label = `${store.name} · ${lastVisitLabel(store.id, lastVisits)}`;
    kb.text(label, `store:${store.id}`).row();
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
