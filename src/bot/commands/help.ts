import { BotContext } from '../middleware/auth.js';

export async function handleHelp(ctx: BotContext): Promise<void> {
  const isAdmin = ctx.user?.role === 'admin';

  const adminBlock = isAdmin
    ? `\n🛠 *Admin*\n` +
      `/grantaccess — add a CM\n` +
      `/revokeaccess — remove a CM\n` +
      `/listaccess — list all active CMs\n\n`
    : '';

  await ctx.reply(
    `📱 *Commands*\n\n` +
    `📍 /visit — log a new store visit\n` +
    `👤 /myprofile — your profile, stores & recent visits\n` +
    `🚫 /cancel — stop what you're doing\n` +
    `❓ /help — show this\n` +
    adminBlock + `\n` +
    `📝 *How to write great visit notes*\n\n` +
    `You'll get a 5-section template. Here's what goes in each:\n\n` +
    `🌟 *Good News*\n` +
    `Wins, great staff moments, strong sales.\n` +
    `_e.g. "Aisyah upsold a Sonos Move to a walk-in today."_\n\n` +
    `🔍 *Competitors' Insights*\n` +
    `What other brands are doing — promos, demos, shelf changes.\n` +
    `_e.g. "Bose had a promoter in doing live QC45 demos."_\n\n` +
    `📦 *Display & Stock*\n` +
    `Demo unit condition, display quality, shelf space won or lost.\n` +
    `_e.g. "Era 300 demo cracked — needs replacement. Arc end-cap looks great."_\n\n` +
    `✅ *What to Follow Up*\n` +
    `Action items for you or the team before your next visit.\n` +
    `_e.g. "Check if replacement unit arrived. Follow up with James on Trueplay."_\n\n` +
    `⚡ *Buzz Plan*\n` +
    `Your tactic for driving sales at this store.\n` +
    `_e.g. "Offered the team a dinner if they hit 10K this month."_\n\n` +
    `💡 *Tip:* Names, models, and numbers make your notes 10x more useful.`,
    { parse_mode: 'Markdown' },
  );
}
