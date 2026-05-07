import { BotContext } from '../middleware/auth.js';

export async function handleStart(ctx: BotContext): Promise<void> {
  const firstName = ctx.user?.full_name?.split(' ')[0] || ctx.from?.first_name || 'there';

  await ctx.reply(
    `Hey ${firstName}! 👋 Welcome to the TC Store Visit Bot.\n\n` +
    `📍 /visit — Log a store visit\n` +
    `👤 /myprofile — Your stores, stats & recent visits\n` +
    `❓ /help — How to write great visit notes\n` +
    `🚫 /cancel — Stop what you're doing\n\n` +
    (ctx.user
      ? `You're set up as a ${ctx.user.role.toUpperCase()} in ${ctx.user.market}. Ready to go! ✅`
      : `⚠️ You're not set up yet — ask your manager to add you.`),
  );
}
