import { BotContext } from '../middleware/auth.js';

export async function handleHelp(ctx: BotContext): Promise<void> {
  const isAdmin = ctx.user?.role === 'admin';

  const adminBlock = isAdmin
    ? `\n🛠 *Admin commands*\n` +
      `/grantaccess — add a CM\n` +
      `/revokeaccess — remove a CM\n` +
      `/listaccess — list all active CMs\n\n`
    : '';

  await ctx.reply(
    `📱 *Commands*\n\n` +
    `/visit — log a new store visit\n` +
    `/mystores — your stores + when you last visited each\n` +
    `/myvisits — your last 5 visits (tap to view)\n` +
    `/storevisits — see your visit history at a specific store\n` +
    `/cancel — stop what you're doing\n` +
    `/help — show this\n` +
    adminBlock + `\n` +
    `📝 *How to write great visit notes*\n\n` +
    `You'll get a 5-section template. Here's what goes in each:\n\n` +
    `*1. Good News*\n` +
    `Wins, positive feedback, great staff moments.\n` +
    `_e.g. "Aisyah upsold a Sonos Move to a walk-in today."_\n\n` +
    `*2. Competitors' Insights*\n` +
    `What other brands are doing — promos, demos, shelf changes.\n` +
    `_e.g. "Bose had a promoter in doing live QC45 demos."_\n\n` +
    `*3. Display & Stock*\n` +
    `Demo unit condition, display quality, shelf space won or lost.\n` +
    `_e.g. "Era 300 demo cracked — needs replacement. Arc end-cap looks great."_\n\n` +
    `*4. What to Follow Up*\n` +
    `Action items for you or the team before your next visit.\n` +
    `_e.g. "Check if replacement unit arrived. Follow up with James on Trueplay."_\n\n` +
    `*5. Buzz Plan*\n` +
    `Your tactic for driving sales at this store.\n` +
    `_e.g. "Offered the team a dinner if they hit 10K this month."_\n\n` +
    `💡 *Tip:* Names, models, and numbers make your notes 10x more useful.`,
    { parse_mode: 'Markdown' },
  );
}
