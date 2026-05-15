import { Api, InlineKeyboard } from 'grammy';
import { config } from '../config.js';

export function buildJoinRequestKeyboard(telegramId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('SG', `join:approve:${telegramId}:SG`)
    .text('MY', `join:approve:${telegramId}:MY`)
    .text('HK', `join:approve:${telegramId}:HK`)
    .text('TH', `join:approve:${telegramId}:TH`)
    .row()
    .text('✗ Reject', `join:reject:${telegramId}`);
}

interface BroadcastInput {
  telegramId: number;
  fullName: string;
  username?: string;
}

export async function broadcastJoinRequest(
  input: BroadcastInput,
  botApi: Api,
): Promise<void> {
  if (!config.joinRequests.chatId) {
    console.log('[join] JOIN_REQUEST_CHAT_ID / BROADCAST_CHAT_ID not set — skipping');
    return;
  }
  try {
    const handle = input.username ? `@${input.username}` : `(no username)`;
    const text =
      `📨 Join request\n\n` +
      `Name: ${input.fullName}\n` +
      `Telegram: ${handle}\n` +
      `ID: ${input.telegramId}\n\n` +
      `Pick a market to approve, or reject:`;

    await botApi.sendMessage(config.joinRequests.chatId, text, {
      reply_markup: buildJoinRequestKeyboard(input.telegramId),
    });
  } catch (err) {
    console.error('[join] broadcast failed:', err);
  }
}
