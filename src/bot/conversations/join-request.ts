import { Conversation } from '@grammyjs/conversations';
import { BotContext } from '../middleware/auth.js';
import { createPendingCM } from '../../db/queries/cms.js';
import { broadcastJoinRequest } from '../../notifications/join-request-broadcast.js';

type JoinConversation = Conversation<BotContext, BotContext>;

export async function joinRequestFlow(
  conversation: JoinConversation,
  ctx: BotContext,
): Promise<void> {
  const telegramId = ctx.from?.id;
  const username = ctx.from?.username;
  if (!telegramId) return;

  await ctx.reply(
    "Got it 👍 What's your full name? (so your manager can recognise you when they approve your request)",
  );

  let fullName = '';
  while (!fullName) {
    const msg = await conversation.wait();

    if (msg.message?.text === '/cancel') {
      await ctx.reply("All good — let me know when you're ready 👋");
      return;
    }

    const txt = msg.message?.text?.trim();
    if (!txt) {
      await ctx.reply('Please send your name as a text message. /cancel to stop.');
      continue;
    }
    if (txt.length < 2 || txt.length > 80) {
      await ctx.reply('Name should be 2–80 characters. Try again. /cancel to stop.');
      continue;
    }
    fullName = txt;
  }

  const ok = await conversation.external(() => createPendingCM({ telegram_id: telegramId, full_name: fullName }));

  if (!ok) {
    await ctx.reply("Hmm — couldn't save your request. Try /start again in a moment 🙏");
    return;
  }

  await conversation.external(() => broadcastJoinRequest({ telegramId, fullName, username }, ctx.api));

  await ctx.reply(
    `Thanks ${fullName.split(' ')[0]}! 🙌\n\n` +
    `Request sent to your manager. You'll get a message here once you're approved.`,
  );
}
