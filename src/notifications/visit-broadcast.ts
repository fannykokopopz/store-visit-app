import { Api, InlineKeyboard } from 'grammy';
import { supabase } from '../db/client.js';
import { config } from '../config.js';

interface BroadcastRow {
  id: string;
  stores: { name: string | null; chain: string | null } | null;
  cms: { full_name: string | null; nickname: string | null } | null;
}

export async function broadcastVisitLocked(
  visitId: string,
  botApi: Api,
): Promise<void> {
  if (!config.broadcast.chatId) {
    console.log('[broadcast] BROADCAST_CHAT_ID not set — skipping');
    return;
  }
  if (!config.broadcast.botUsername) {
    console.log('[broadcast] TELEGRAM_BOT_USERNAME not set — skipping');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('visits')
      .select('id, stores(name, chain), cms(full_name, nickname)')
      .eq('id', visitId)
      .single();

    if (error || !data) {
      console.error('[broadcast] visit lookup failed:', error);
      return;
    }

    const row = data as unknown as BroadcastRow;
    const cmName = row.cms?.nickname || row.cms?.full_name || 'Someone';
    const storeName = row.stores?.name ?? 'a store';
    const storeChain = row.stores?.chain;
    const storeLabel = storeChain ? `${storeName} @ ${storeChain}` : storeName;

    const text = `✅ ${cmName} visited ${storeLabel}`;
    const deepLink =
      `https://t.me/${config.broadcast.botUsername}/${config.miniapp.shortName}` +
      `?startapp=visit_${visitId}`;

    await botApi.sendMessage(config.broadcast.chatId, text, {
      reply_markup: new InlineKeyboard().url('View visit', deepLink),
      link_preview_options: { is_disabled: true },
    });
  } catch (err) {
    console.error('[broadcast] failed:', err);
  }
}
