import { BotContext, requireAdmin } from '../../middleware/auth.js';
import { createCM, CM } from '../../../db/queries/cms.js';

// Usage: /grantaccess <telegram_id> <full_name> [role=cm] [market=SG]
// Example: /grantaccess 123456789 "Wilson Tan" admin SG
export async function handleGrantAccess(ctx: BotContext): Promise<void> {
  if (!requireAdmin(ctx)) return;

  const args = ctx.message?.text?.split(/\s+/).slice(1) ?? [];
  if (args.length < 2) {
    await ctx.reply(
      'Usage: /grantaccess <telegram\\_id> <full\\_name> [role] [market]\n' +
      'Role: cm (default) | cmic | am | admin\n' +
      'Market: SG (default) | TH | MY | HK\n\n' +
      'Example: `/grantaccess 123456789 Alice Tan cmic SG`',
      { parse_mode: 'Markdown' },
    );
    return;
  }

  const telegramId = parseInt(args[0], 10);
  if (isNaN(telegramId)) {
    await ctx.reply('Invalid Telegram ID — must be a number.');
    return;
  }

  const fullName = args[1];
  const role = (args[2] as CM['role']) || 'cm';
  const market = (args[3] as CM['market']) || 'SG';

  const validRoles: CM['role'][] = ['cm', 'cmic', 'am', 'admin'];
  const validMarkets: CM['market'][] = ['SG', 'TH', 'MY', 'HK'];

  if (!validRoles.includes(role)) {
    await ctx.reply(`Invalid role "${role}". Use: cm, cmic, am, admin.`);
    return;
  }
  if (!validMarkets.includes(market)) {
    await ctx.reply(`Invalid market "${market}". Use: SG, TH, MY, HK.`);
    return;
  }

  const cm = await createCM({ telegram_id: telegramId, full_name: fullName, role, market });
  if (!cm) {
    await ctx.reply('Failed to add user. Check logs.');
    return;
  }

  await ctx.reply(
    `✅ Access granted:\n*${fullName}* (${role.toUpperCase()}, ${market})\nTelegram ID: \`${telegramId}\``,
    { parse_mode: 'Markdown' },
  );
}
