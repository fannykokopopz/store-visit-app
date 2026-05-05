import { Bot, session } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import { config } from '../config.js';
import { BotContext, authMiddleware, requireAuth } from './middleware/auth.js';
import { handleStart } from './commands/start.js';
import { handleHelp } from './commands/help.js';
import { handleMyStores } from './commands/mystores.js';
import { handleMyVisits } from './commands/myvisits.js';
import { handleCancel } from './commands/cancel.js';
import { handleGrantAccess } from './commands/admin/grant.js';
import { handleRevokeAccess } from './commands/admin/revoke.js';
import { handleListAccess } from './commands/admin/list.js';
import { visitFlow } from './conversations/visit-flow.js';

export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(config.telegram.botToken);

  bot.use(session({ initial: () => ({}) }));
  bot.use(conversations());
  bot.use(authMiddleware);

  bot.use(createConversation(visitFlow));

  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command('mystores', handleMyStores);
  bot.command('myvisits', handleMyVisits);
  bot.command('cancel', handleCancel);

  bot.command('visit', async (ctx) => {
    const user = requireAuth(ctx);
    if (!user) return;
    await ctx.conversation.enter('visitFlow');
  });

  // Admin commands
  bot.command('grantaccess', handleGrantAccess);
  bot.command('revokeaccess', handleRevokeAccess);
  bot.command('listaccess', handleListAccess);

  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error handling update ${ctx.update.update_id}:`, err.error);

    const message =
      err.error instanceof Error && err.error.message === 'CANCELLED'
        ? 'Action cancelled.'
        : 'Something went wrong. Try again or type /cancel to reset.';

    ctx.reply(message).catch(console.error);
  });

  return bot;
}
