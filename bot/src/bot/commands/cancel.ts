import { BotContext } from '../middleware/auth.js';

export async function handleCancel(ctx: BotContext): Promise<void> {
  await ctx.conversation.exit('visitFlow');
  await ctx.conversation.exit('editVisitFlow');
  await ctx.conversation.exit('myStoresFlow');
  await ctx.conversation.exit('staffFlow');
  await ctx.reply('All cleared! Type /visit whenever you want to start fresh.');
}
