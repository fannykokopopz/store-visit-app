import { BotContext, requireAdmin } from '../../middleware/auth.js';
import { getSetting, setSetting } from '../../../db/queries/settings.js';
import { config } from '../../../config.js';

const KEY = 'broadcast_chat_id';

// Usage: /setalertgroup <chat_id>
// Example: /setalertgroup -1001234567890
// No args = show the current value.
export async function handleSetAlertGroup(ctx: BotContext): Promise<void> {
  const admin = requireAdmin(ctx);
  if (!admin) return;

  const args = ctx.message?.text?.split(/\s+/).slice(1) ?? [];

  if (args.length === 0) {
    const current = await getSetting(KEY);
    const effective = current ?? config.broadcast.chatId ?? null;
    const source = current ? 'db' : config.broadcast.chatId ? 'env fallback' : 'unset';
    await ctx.reply(
      `📣 *Visit alerts group*\n\n` +
      `Current: \`${effective ?? '— not set —'}\` _(${source})_\n\n` +
      `To change it:\n\`/setalertgroup <chat_id>\`\n\n` +
      `_Tip: add the bot to the group, then forward any message from there to @userinfobot to get the chat ID (starts with -100…)._`,
      { parse_mode: 'Markdown' },
    );
    return;
  }

  const raw = args[0];
  const chatId = parseInt(raw, 10);
  if (isNaN(chatId)) {
    await ctx.reply('Invalid chat ID — must be a number (group IDs start with -100…).');
    return;
  }

  // Sanity-check: bot must be able to post there.
  try {
    await ctx.api.sendMessage(chatId, '✅ This group is now set to receive SVA visit alerts.');
  } catch (err) {
    console.error('[setalertgroup] sendMessage probe failed:', err);
    await ctx.reply(
      `Couldn't post to that chat. Make sure the bot is added to the group and has permission to send messages, then try again.`,
    );
    return;
  }

  const ok = await setSetting(KEY, String(chatId), admin.telegram_id);
  if (!ok) {
    await ctx.reply('Saved test message but failed to persist setting. Check logs.');
    return;
  }

  await ctx.reply(
    `✅ Visit alerts will now be sent to chat \`${chatId}\`.`,
    { parse_mode: 'Markdown' },
  );
}
