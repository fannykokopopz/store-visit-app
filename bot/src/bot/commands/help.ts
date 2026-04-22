import { Context } from 'grammy';

export async function handleHelp(ctx: Context): Promise<void> {
  await ctx.reply(
    `*Here's what I can do:*\n\n` +
    `/visit — Log a store visit\n` +
    `/editvisit — Edit a recent visit\n` +
    `/mystores — See your stores + stats\n` +
    `/staff — Manage all your store staff\n` +
    `/cancel — Cancel what you're doing\n\n` +
    `───────────────\n\n` +
    `📝 *Tips for great store updates*\n\n` +
    `When you /visit, you'll get a 5-section template. Here's what works well in each:\n\n` +
    `*1️⃣ Good News*\n` +
    `Wins, positive feedback, strong sales moments.\n` +
    `_"Sold 3x Era 300 this week — staff are pitching it confidently now."_\n\n` +
    `*2️⃣ Competitors' Insights*\n` +
    `What other brands are doing — promos, new displays, staffing.\n` +
    `_"Bose running 20% off on their portable range this month."_\n\n` +
    `*3️⃣ Display & Stock*\n` +
    `How the display looks, stock issues, demo unit status.\n` +
    `_"Era 300 demo has no power — needs a cable. Stock low on Move 2."_\n\n` +
    `*4️⃣ What to Follow Up*\n` +
    `Anything that needs action before your next visit.\n` +
    `_"Need to bring replacement POS materials next week."_\n\n` +
    `*5️⃣ Buzz Plan*\n` +
    `Upcoming training plans, events, or store activations.\n` +
    `_"Planning a lunch demo session for staff next Friday."_\n\n` +
    `💡 *Pro tip:* Be specific! Names, product models, and numbers make your notes way more useful for everyone.`,
    { parse_mode: 'Markdown' },
  );
}
