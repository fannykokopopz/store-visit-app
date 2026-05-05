import { BotContext, requireAdmin } from '../../middleware/auth.js';
import { getAllCMs } from '../../../db/queries/cms.js';

// Usage: /listaccess [market]
export async function handleListAccess(ctx: BotContext): Promise<void> {
  if (!requireAdmin(ctx)) return;

  const args = ctx.message?.text?.split(/\s+/).slice(1) ?? [];
  const market = args[0]?.toUpperCase() || undefined;

  const cms = await getAllCMs(market);

  if (cms.length === 0) {
    await ctx.reply(market ? `No active users in ${market}.` : 'No active users yet.');
    return;
  }

  const byMarket: Record<string, string[]> = {};
  for (const cm of cms) {
    if (!byMarket[cm.market]) byMarket[cm.market] = [];
    byMarket[cm.market].push(`  ${cm.role.toUpperCase()} · ${cm.full_name} (\`${cm.telegram_id}\`)`);
  }

  let msg = `*Active users (${cms.length}):*\n`;
  for (const [mkt, lines] of Object.entries(byMarket)) {
    msg += `\n*${mkt}*\n${lines.join('\n')}\n`;
  }

  await ctx.reply(msg, { parse_mode: 'Markdown' });
}
