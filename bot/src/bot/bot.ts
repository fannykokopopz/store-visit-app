import { Bot, session } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import { config } from '../config.js';
import { BotContext, authMiddleware, requireAuth } from './middleware/auth.js';
import { handleStart } from './commands/start.js';
import { handleHelp } from './commands/help.js';
import { handleMyStores } from './commands/mystores.js';
import { handleCancel } from './commands/cancel.js';
import { visitFlow } from './conversations/visit-flow.js';
import { editVisitFlow } from './conversations/editvisit-flow.js';

export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(config.telegram.botToken);

  // Middleware
  bot.use(session({ initial: () => ({}) }));
  bot.use(conversations());
  bot.use(authMiddleware);

  // Conversations
  bot.use(createConversation(visitFlow));
  bot.use(createConversation(editVisitFlow));

  // Commands
  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command('mystores', handleMyStores);
  bot.command('cancel', handleCancel);
  bot.command('visit', async (ctx) => {
    const user = requireAuth(ctx);
    if (!user) return;
    await ctx.conversation.enter('visitFlow');
  });
  bot.command('editvisit', async (ctx) => {
    const user = requireAuth(ctx);
    if (!user) return;
    await ctx.conversation.enter('editVisitFlow');
  });

  // Error handler
  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`, err.error);

    const message = err.error instanceof Error && err.error.message === 'CANCELLED'
      ? 'Action cancelled.'
      : 'Something went wrong. Try again or type /cancel to reset.';

    ctx.reply(message).catch(console.error);
  });

  return bot;
}
