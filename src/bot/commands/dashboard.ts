import { BotContext } from '../middleware/auth.js';
import { config } from '../../config.js';

export async function handleDashboard(ctx: BotContext): Promise<void> {
  const url = config.dashboard.url;
  if (!url) {
    await ctx.reply('Dashboard URL not configured yet. Ask your admin to set it up.');
    return;
  }
  await ctx.reply(
    `📊 *SVA Dashboard*\n\nView all store visits, staff & allies, and team stats.\n\n👉 ${url}`,
    { parse_mode: 'Markdown' },
  );
}
