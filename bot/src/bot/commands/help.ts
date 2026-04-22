import { Context } from 'grammy';

export async function handleHelp(ctx: Context): Promise<void> {
  await ctx.reply(
    `📝 *How to write good visit notes*\n\n` +
    `The bot walks you through 4 categories. Here's what to include:\n\n` +
    `*Relationship (R)*\n` +
    `How many staff you spoke to, names if possible, key insights from conversations.\n` +
    `Example: "Spoke to James and Li Wei. James mentioned Bose promoter was in yesterday doing demos."\n\n` +
    `*Training (T)*\n` +
    `Who you trained, what products, whether they're ready for ally status.\n` +
    `Example: "Trained Li Wei on Arc Ultra and Trueplay. He's confident — ally-ready."\n\n` +
    `*Experience (E)*\n` +
    `Display quality, demo unit status, space gained or lost.\n` +
    `Example: "Era 300 demo cracked, needs replacement. Bose took our end-cap."\n\n` +
    `*Creative Methods (C)*\n` +
    `Any innovative tactics you tried — skip if nothing special.\n` +
    `Example: "Offered the team a dinner challenge if they hit 10K this month."\n\n` +
    `💡 *Tip:* Be specific. Names, product models, and numbers make your notes way more useful.`,
    { parse_mode: 'Markdown' },
  );
}
