import { BotContext } from '../middleware/auth.js';

export async function handleCancel(ctx: BotContext): Promise<void> {
  await ctx.conversation.exit('visitFlow');
  await ctx.reply('No worries — come back whenever you\'re ready 👋');
}
