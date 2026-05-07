import { BotContext } from '../middleware/auth.js';

export async function handleStart(ctx: BotContext): Promise<void> {
  const name = ctx.user?.full_name || ctx.from?.first_name || 'there';

  await ctx.reply(
    `Hey ${name}! 👋 Welcome to the TC Store Visit Bot.\n\n` +
    `Here's what you can do:\n` +
    `/visit — Log a store visit\n` +
    `/mystores — See your store portfolio\n` +
    `/myvisits — Your recent visits\n` +
    `/help — How to write great visit notes\n` +
    `/cancel — Cancel what you're doing\n\n` +
    (ctx.user
      ? `You're set up as a ${ctx.user.role.toUpperCase()} in ${ctx.user.market}. Ready to go! ✅`
      : `⚠️ You're not set up yet — ask your manager to add you.`),
  );
}
