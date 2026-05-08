import { BotContext } from '../middleware/auth.js';

export async function handleHelp(ctx: BotContext): Promise<void> {
  const isAdmin = ctx.user?.role === 'admin';

  const adminBlock = isAdmin
    ? `\n🛠 *Admin commands*\n` +
      `/grantaccess — add a CM\n` +
      `/revokeaccess — remove a CM\n` +
      `/listaccess — list all active CMs\n`
    : '';

  await ctx.reply(
    `📱 *Commands*\n\n` +
    `🏪 /visit — log a new store visit\n` +
    `📊 /dashboard — open the team dashboard\n` +
    `✏️ /nickname — set your display name\n` +
    `🚫 /cancel — stop what you're doing\n` +
    adminBlock + `\n` +
    `📝 *How the visit template works*\n\n` +
    `You'll get 6 sections to fill in:\n` +
    `🌟 Good News · 🔍 Competitors · 📦 Display & Stock\n` +
    `✅ Follow Up · ⚡ Buzz Plan · 🎓 Training\n\n` +
    `💡 _Names, numbers, and specifics make your notes 10× more useful._`,
    { parse_mode: 'Markdown' },
  );
}
