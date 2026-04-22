import { InlineKeyboard } from 'grammy';
import { Store } from '../../db/queries/stores.js';

export function buildStorePicker(stores: Store[]): InlineKeyboard {
  const kb = new InlineKeyboard();

  for (const store of stores) {
    kb.text(store.name, `store:${store.id}`).row();
  }

  kb.text('Cancel', 'cancel').row();
  return kb;
}

export function buildCategoryMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('Relationship', 'cat:relationship')
    .text('Training', 'cat:training').row()
    .text('Experience', 'cat:experience')
    .text('Creative', 'cat:creative').row()
    .text('Add Photos', 'cat:photos').row()
    .text('Done — save changes', 'cat:done').row();
}
