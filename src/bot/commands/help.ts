import { BotContext, isManager } from '../middleware/auth.js';

export async function handleHelp(ctx: BotContext): Promise<void> {
  const role = ctx.user?.role;
  const isAdmin = role === 'admin';
  const manager = isManager(ctx.user);

  const managerBlock = manager
    ? `\n👥 *Manager commands*\n` +
      `/dashboard — open the team dashboard\n` +
      `_(assign stores to CMs in the dashboard → Channel Managers tab)_\n`
    : '';

  const adminBlock = isAdmin
    ? `\n🛠 *Admin commands*\n` +
      `/grantaccess — add a CM\n` +
      `/revokeaccess — remove a CM\n` +
      `/listaccess — list all active CMs\n` +
      `/setalertgroup — set the group where visit alerts are posted\n`
    : '';

  await ctx.reply(
    `📱 *Commands*\n\n` +
    `🏪 /visit — log a new store visit\n` +
    `🔗 /links — store objective + asset verification links\n` +
    `✏️ /nickname — set your display name\n` +
    `🚫 /cancel — stop what you're doing\n` +
    managerBlock +
    adminBlock + `\n` +
    `📝 *How the visit template works*\n\n` +
    `You'll get 5 sections to fill in:\n` +
    `🌟 Good News · 🔍 Competitors · 📦 Display & Stock\n` +
    `✅ Follow Up · ⚡ Buzz Plan\n\n` +
    `💡 _Names, numbers, and specifics make your notes 10× more useful._`,
    { parse_mode: 'Markdown' },
  );
}
