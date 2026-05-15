import { Api, InlineKeyboard } from 'grammy';
import { supabase } from '../db/client.js';
import { config } from '../config.js';
import { getVisitCMs } from '../db/queries/visit-cms.js';

interface BroadcastRow {
  id: string;
  stores: { name: string | null; chain: string | null } | null;
}

function joinNames(names: string[]): string {
  if (names.length === 0) return 'Someone';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
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
    const [visitRes, cmRows] = await Promise.all([
      supabase
        .from('visits')
        .select('id, stores(name, chain)')
        .eq('id', visitId)
        .single(),
      getVisitCMs(visitId),
    ]);

    if (visitRes.error || !visitRes.data) {
      console.error('[broadcast] visit lookup failed:', visitRes.error);
      return;
    }

    const row = visitRes.data as unknown as BroadcastRow;
    const lead = cmRows.find((r) => r.role === 'lead');
    const cos = cmRows.filter((r) => r.role === 'co');
    const allNames = [
      lead ? (lead.nickname || lead.full_name) : 'Someone',
      ...cos.map((c) => c.nickname || c.full_name),
    ];
    const namesLabel = joinNames(allNames);

    const storeName = row.stores?.name ?? 'a store';
    const storeChain = row.stores?.chain;
    const storeLabel = storeChain ? `${storeName} @ ${storeChain}` : storeName;

    const text = `✅ ${namesLabel} visited ${storeLabel}`;
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
