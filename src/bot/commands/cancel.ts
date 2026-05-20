import { BotContext } from '../middleware/auth.js';
import { clearEditSession, isEditing } from '../edit-session.js';

export async function handleCancel(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id ?? 0;
  if (isEditing(telegramId)) clearEditSession(telegramId);
  await ctx.conversation.exitAll();
  await ctx.reply('No worries — come back whenever you\'re ready 👋');
}
