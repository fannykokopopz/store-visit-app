import { BotContext, requireAuth } from '../middleware/auth.js';

export async function handleVisit(ctx: BotContext): Promise<void> {
  const user = requireAuth(ctx);
  if (!user) return;
  await ctx.conversation.enter('visitFlow');
}
