import { BotContext } from '../middleware/auth.js';

export async function handleStart(ctx: BotContext): Promise<void> {
  const name = ctx.user?.full_name || ctx.from?.first_name || 'there';

  await ctx.reply(
    `Hey ${name}! 👋\n\n` +
    `I'm here to help you log store visits — quick and easy.\n\n` +
    `/visit — Log a store visit\n` +
    `/editvisit — Edit a recent visit\n` +
    `/mystores — See your stores at a glance\n` +
    `/help — Tips on writing great updates\n` +
    `/cancel — Cancel what you're doing\n\n` +
    (ctx.user
      ? `You're all set as a ${ctx.user.role.toUpperCase()} in ${ctx.user.market}. Let's go!`
      : `Hmm, I don't have you in the system yet. Check with your manager to get set up!`),
  );
}
