import { BotContext } from '../middleware/auth.js';

export async function handleStart(ctx: BotContext): Promise<void> {
  const name = ctx.user?.full_name || ctx.from?.first_name || 'there';

  await ctx.reply(
    `Hi ${name}! 👋 I'm the TC Store Visit Bot.\n\n` +
    `Here's what I can do:\n` +
    `/visit — Log a store visit\n` +
    `/mystores — View your store portfolio\n` +
    `/editvisit — Edit a recent visit\n` +
    `/help — Tips on writing good visit notes\n` +
    `/cancel — Cancel current action\n\n` +
    (ctx.user
      ? `You're registered as a ${ctx.user.role.toUpperCase()} in ${ctx.user.market}.`
      : `⚠️ You're not registered yet. Contact your manager to get set up.`),
  );
}
