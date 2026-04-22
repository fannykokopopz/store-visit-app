import { Context, NextFunction, SessionFlavor } from 'grammy';
import { ConversationFlavor } from '@grammyjs/conversations';
import { getUserByTelegramId, User } from '../../db/queries/users.js';

type BaseContext = Context & SessionFlavor<{}> & {
  user?: User;
};

export type BotContext = ConversationFlavor<BaseContext>;

export async function authMiddleware(ctx: BotContext, next: NextFunction): Promise<void> {
  const chatId = ctx.from?.id;
  if (!chatId) return;

  const user = await getUserByTelegramId(chatId);
  if (user) {
    ctx.user = user;
  }

  await next();
}

export function requireAuth(ctx: BotContext): User | null {
  if (!ctx.user) {
    ctx.reply(
      "Hmm, I don't have you in the system yet. Check with your manager to get set up!",
    );
    return null;
  }
  return ctx.user;
}
