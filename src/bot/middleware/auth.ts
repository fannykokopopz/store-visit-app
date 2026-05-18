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
    ctx.reply("I don't recognise your account — ask your manager to add you 🙏");
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

export function requireManager(ctx: BotContext): CM | null {
  const user = requireAuth(ctx);
  if (!user) return null;
  if (user.role !== 'admin' && user.role !== 'am' && user.role !== 'cmic') {
    ctx.reply('This command is for AM, CM IC, and admins only — ask your AM if you need access.');
    return null;
  }
  return user;
}

export function isManager(user: CM | undefined): boolean {
  return !!user && (user.role === 'admin' || user.role === 'am' || user.role === 'cmic');
}
