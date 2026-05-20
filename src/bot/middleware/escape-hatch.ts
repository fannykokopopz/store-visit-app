import { NextFunction } from 'grammy';
import { BotContext } from './auth.js';
import { isEditing, clearEditSession } from '../edit-session.js';

// "/visit@svabot foo" → "/visit". Returns null if not a command.
function extractCommand(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) return null;
  const m = trimmed.match(/^\/[A-Za-z0-9_]+/);
  return m ? m[0].toLowerCase() : null;
}

// Typing any command mid-flow auto-cancels the current flow. Without this,
// commands typed inside a grammY conversation get swallowed by `conversation.wait()`,
// and commands typed during an edit session leave orphan state in the edit map.
export async function escapeHatchMiddleware(
  ctx: BotContext,
  next: NextFunction,
): Promise<void> {
  const text = ctx.message?.text ?? ctx.message?.caption ?? '';
  const cmd = extractCommand(text);
  if (!cmd) return next();

  const telegramId = ctx.from?.id ?? 0;

  // Any command means the user is moving on — drop any edit session they had open.
  if (isEditing(telegramId)) {
    clearEditSession(telegramId);
  }

  // /cancel still flows through normally: conversations handle it inline,
  // and bot.command('cancel', ...) covers the no-conversation case.
  if (cmd === '/cancel') return next();

  const active = ctx.conversation.active();
  const hasActive = Object.values(active).some((n) => n > 0);
  if (hasActive) {
    await ctx.conversation.exitAll();
    await ctx.reply(`Cancelled — running ${cmd} 👍`);
  }

  return next();
}
