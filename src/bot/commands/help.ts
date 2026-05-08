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
    `Here's what I can do 👇\n\n` +
    `🏪 /visit — log a store visit\n` +
    `📊 /dashboard — open the team dashboard\n` +
    `✏️ /nickname — set your display name\n` +
    `🚫 /cancel — stop what you're doing\n` +
    adminBlock + `\n` +
    `💡 *Quick tip:* When you /visit, you'll get a 6-section template — Good News, Competitors, Display & Stock, Follow Up, Buzz Plan, Training. Fill in what you can. Names, numbers, and specifics make your notes 10× more useful.`,
    { parse_mode: 'Markdown' },
  );
}
