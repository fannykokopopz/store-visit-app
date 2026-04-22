import { Context, NextFunction, SessionFlavor } from 'grammy';
import { ConversationFlavor } from '@grammyjs/conversations';
import { getUserByTelegramId, User } from '../../db/queries/users.js';

type BaseContext = Context & SessionFlavor<{}> & {
  user?: User;
};

export type BotContext = ConversationFlavor<BaseContext>;

export async function authMiddleware(ctx: BotContext, next: NextFunction): Promise<void> {
  const chatId = ctx.from?.id;
  console.log('[auth] from.id:', chatId);
  if (!chatId) return;

  const user = await getUserByTelegramId(chatId);
  console.log('[auth] user lookup result:', user ? user.full_name : 'NOT FOUND');
  if (user) {
    ctx.user = user;
  }

  await next();
}

export function requireAuth(ctx: BotContext): User | null {
  if (!ctx.user) {
    ctx.reply(
      "I don't recognise your account. Please contact your manager to get set up.",
    );
    return null;
  }
  return ctx.user;
}
