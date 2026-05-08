import { BotContext, requireAuth } from '../middleware/auth.js';
import { updateNickname } from '../../db/queries/cms.js';

export async function handleNickname(ctx: BotContext): Promise<void> {
  const user = requireAuth(ctx);
  if (!user) return;

  const args = ctx.message?.text?.split(' ').slice(1).join(' ').trim();

  if (!args) {
    const current = user.nickname ?? user.full_name.split(' ')[0];
    await ctx.reply(
      `Your display name is currently *${current}*.\n\nTo change it, send:\n/nickname YourName`,
      { parse_mode: 'Markdown' },
    );
    return;
  }

  if (args.length > 30) {
    await ctx.reply("Keep it under 30 characters 😊");
    return;
  }

  const ok = await updateNickname(user.telegram_id, args);
  if (ok) {
    await ctx.reply(`Got it — I'll call you *${args}* from now on 👋`, { parse_mode: 'Markdown' });
  } else {
    await ctx.reply("Something went wrong. Give it another try.");
  }
}
