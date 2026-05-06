import { BotContext } from '../middleware/auth.js';

export async function handleHelp(ctx: BotContext): Promise<void> {
  const isAdmin = ctx.user?.role === 'admin';

  const adminBlock = isAdmin
    ? `\n🛠 *Admin commands*\n` +
      `/grantaccess — add a CM to the allowlist\n` +
      `/revokeaccess — remove a CM\n` +
      `/listaccess — list all active CMs\n\n`
    : '';

  await ctx.reply(
    `🤖 *Commands*\n\n` +
    `/visit — log a new store visit\n` +
    `/mystores — your assigned stores + last-visit-ago\n` +
    `/myvisits — your last 5 visits (tap to view)\n` +
    `/storevisits — pick a store, see all your visits there\n` +
    `/cancel — abort the current action\n` +
    `/help — show this help\n` +
    adminBlock + `\n` +
    `📝 *How to log a great visit*\n\n` +
    `The bot gives you a 5-section template. Here's what to write:\n\n` +
    `*1. Good News*\n` +
    `Wins, positive feedback, strong staff moments.\n` +
    `Example: "Aisyah upsold a Sonos Move to a walk-in customer today."\n\n` +
    `*2. Competitors' Insights*\n` +
    `What competing brands are doing — promotions, demos, shelf space changes.\n` +
    `Example: "Bose had a promoter in doing live demos on QC45."\n\n` +
    `*3. Display & Stock*\n` +
    `Demo unit condition, display quality, shelf space gained or lost.\n` +
    `Example: "Era 300 demo cracked — needs replacement. Arc end-cap looks great."\n\n` +
    `*4. What to Follow Up*\n` +
    `Action items — who to contact, what to check next visit.\n` +
    `Example: "Check if replacement unit arrived. Follow up with James on Trueplay demo."\n\n` +
    `*5. Buzz Plan*\n` +
    `Your plan or creative tactic for driving sales at this store.\n` +
    `Example: "Offered the team a team dinner if they hit 10K this month."\n\n` +
    `💡 *Tip:* Names, product models, and numbers make your notes far more useful.`,
    { parse_mode: 'Markdown' },
  );
}
