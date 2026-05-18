import { BotContext, requireManager } from '../middleware/auth.js';

export async function handleDashboard(ctx: BotContext): Promise<void> {
  if (!requireManager(ctx)) return;

  const url = process.env.DASHBOARD_URL;
  if (!url) {
    await ctx.reply('Dashboard URL not configured yet. Ask your admin to set it up.');
    return;
  }
  await ctx.reply(
    `📊 *SVA Dashboard*\n\nView all store visits, staff & allies, and team stats.\n\n👉 ${url}`,
    { parse_mode: 'Markdown' },
  );
}
