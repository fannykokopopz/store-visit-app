import { InlineKeyboard, Keyboard } from 'grammy';
import { BotContext } from '../middleware/auth.js';
import { getCMRecord } from '../../db/queries/cms.js';

export const QUICK_ACCESS_KEYBOARD = new Keyboard()
  .text('🏪 Log Visit').text('🔗 Links')
  .resized()
  .persistent();

export async function handleStart(ctx: BotContext): Promise<void> {
  const name = ctx.user?.nickname ?? ctx.user?.full_name?.split(' ')[0] ?? ctx.from?.first_name ?? 'there';

  if (!ctx.user) {
    const telegramId = ctx.from?.id;
    const existing = telegramId ? await getCMRecord(telegramId) : null;

    if (existing && existing.pending_request_at && !existing.is_active) {
      await ctx.reply(
        `Hey ${existing.full_name.split(' ')[0]} 👋\n\n` +
        `Your request to join is pending — your manager will approve it soon. We'll ping you here when it's done.`,
      );
      return;
    }

    await ctx.reply(
      `Hey ${name}! 👋\n\n` +
      `You're not registered yet. Would you like to request access?`,
      {
        reply_markup: new InlineKeyboard()
          .text('Request access', 'join:request')
          .text('Maybe later', 'join:later'),
      },
    );
    return;
  }

  await ctx.reply(
    `Hey ${name}! 👋 Good to see you.\n\n` +
    `*Your store visit companion.* Log a visit in under 2 min, right from here 🚀\n\n` +
    `🏪 /visit — log a store visit\n` +
    `📊 /dashboard — team dashboard\n` +
    `✏️ /nickname — change your name\n` +
    `❓ /help — how it all works\n\n` +
    `You're in as *${ctx.user.role.toUpperCase()} · ${ctx.user.market}* ✅`,
    { parse_mode: 'Markdown', reply_markup: QUICK_ACCESS_KEYBOARD },
  );
}
