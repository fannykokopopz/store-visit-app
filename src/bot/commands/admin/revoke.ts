import { BotContext, requireAdmin } from '../../middleware/auth.js';
import { deactivateCM } from '../../../db/queries/cms.js';

// Usage: /revokeaccess <telegram_id>
export async function handleRevokeAccess(ctx: BotContext): Promise<void> {
  if (!requireAdmin(ctx)) return;

  const args = ctx.message?.text?.split(/\s+/).slice(1) ?? [];
  if (args.length < 1) {
    await ctx.reply('Usage: /revokeaccess <telegram\\_id>', { parse_mode: 'Markdown' });
    return;
  }

  const telegramId = parseInt(args[0], 10);
  if (isNaN(telegramId)) {
    await ctx.reply('Invalid Telegram ID — must be a number.');
    return;
  }

  const ok = await deactivateCM(telegramId);
  if (!ok) {
    await ctx.reply('Failed to revoke access. Check logs.');
    return;
  }

  await ctx.reply(`✅ Access revoked for Telegram ID \`${telegramId}\`.`, { parse_mode: 'Markdown' });
}
