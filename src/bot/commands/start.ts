import { BotContext } from '../middleware/auth.js';

export async function handleStart(ctx: BotContext): Promise<void> {
  const name = ctx.user?.nickname ?? ctx.user?.full_name?.split(' ')[0] ?? ctx.from?.first_name ?? 'there';

  if (!ctx.user) {
    await ctx.reply(
      `Hey ${name}! 👋\n\n` +
      `⚠️ You're not set up yet — ask your manager to add you to the bot.`,
    );
    return;
  }

  await ctx.reply(
    `Hey ${name}! 👋\n\n` +
    `This is your store visit sidekick. Log a visit in under 2 minutes, right from here.\n\n` +
    `🏪 /visit — log a store visit\n` +
    `📊 /dashboard — open the team dashboard\n` +
    `❓ /help — how it all works\n\n` +
    `You're set up as ${ctx.user.role.toUpperCase()} · ${ctx.user.market} ✅`,
  );
}
