import { Context, NextFunction, SessionFlavor } from 'grammy';
import { ConversationFlavor } from '@grammyjs/conversations';
import { getCMByTelegramId, CM } from '../../db/queries/cms.js';

type BaseContext = Context & SessionFlavor<{}> & {
  user?: CM;
};

export type BotContext = ConversationFlavor<BaseContext>;

export async function authMiddleware(ctx: BotContext, next: NextFunction): Promise<void> {
  const telegramId = ctx.from?.id;
  console.log('[auth] from.id:', telegramId);
  if (!telegramId) return;

  const cm = await getCMByTelegramId(telegramId);
  console.log('[auth] CM lookup result:', cm ? cm.full_name : 'NOT FOUND');
  if (cm) {
    ctx.user = cm;
  }

  await next();
}

export function requireAuth(ctx: BotContext): CM | null {
  if (!ctx.user) {
    ctx.reply(
      "I don't recognise your account. Please contact your manager to get set up.",
    );
    return null;
  }
  return ctx.user;
}

export function requireAdmin(ctx: BotContext): CM | null {
  const user = requireAuth(ctx);
  if (!user) return null;
  if (user.role !== 'admin') {
    ctx.reply('This command is for admins only.');
    return null;
  }
  return user;
}
