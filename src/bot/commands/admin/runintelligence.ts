import { BotContext, requireAdmin } from '../../middleware/auth.js';
import {
  getVisitsForReportDate,
  getAllCurrentMemoryNotes,
  insertMemoryNoteVersion,
  upsertMemoryEdges,
  insertIntelligenceReport,
  markVisitsAnalyzed,
} from '../../../db/queries/intelligence.js';
import {
  runDailyIntelligence,
  validateRunResult,
} from '../../../ai/daily-intelligence.js';
import { broadcastIntelligenceBrief } from '../../broadcast-intelligence.js';
import { config } from '../../../config.js';

// Usage:
//   /runintelligence                         → today (SGT)
//   /runintelligence 2026-05-18              → specific date
//   /runintelligence 2026-05-18 dry          → preview (no writes, no broadcast)
//   /runintelligence 2026-05-18 nobroadcast  → write to DB but skip Telegram
//   /runintelligence today nobroadcast       → today + skip Telegram

function sgtToday(): string {
  const utc = Date.now();
  const sgt = new Date(utc + 8 * 60 * 60 * 1000);
  return sgt.toISOString().slice(0, 10);
}

export async function handleRunIntelligence(ctx: BotContext): Promise<void> {
  if (!requireAdmin(ctx)) return;

  const args = ctx.message?.text?.split(/\s+/).slice(1) ?? [];
  const dateArg = args[0]?.toLowerCase();
  const modeArg = args[1]?.toLowerCase();

  const reportDate =
    !dateArg || dateArg === 'today'
      ? sgtToday()
      : /^\d{4}-\d{2}-\d{2}$/.test(dateArg)
      ? dateArg
      : null;

  if (!reportDate) {
    await ctx.reply(
      'Usage: `/runintelligence [YYYY-MM-DD] [dry|nobroadcast]`\n\n' +
        'Examples:\n' +
        '• `/runintelligence` — today\n' +
        '• `/runintelligence 2026-05-18`\n' +
        '• `/runintelligence today dry` — preview only\n' +
        '• `/runintelligence 2026-05-18 nobroadcast`',
      { parse_mode: 'Markdown' },
    );
    return;
  }

  const dryRun = modeArg === 'dry';
  const skipTelegram = modeArg === 'nobroadcast' || dryRun;

  if (!config.anthropic.apiKey) {
    await ctx.reply(
      `⚠️ \`ANTHROPIC_API_KEY\` not set on the bot service. Add it in Railway and redeploy, then try again.\n\n` +
        `For demo-only data, use \`npm run intelligence:seed\` on your laptop instead.`,
      { parse_mode: 'Markdown' },
    );
    return;
  }

  await ctx.reply(
    `🧠 Running intelligence for *${reportDate}*${dryRun ? ' (dry-run)' : ''}${
      skipTelegram && !dryRun ? ' (no broadcast)' : ''
    }…`,
    { parse_mode: 'Markdown' },
  );

  try {
    // 1. Visits
    const visits = await getVisitsForReportDate(reportDate);
    if (visits.length === 0) {
      await ctx.reply(`No locked & unanalyzed visits found for ${reportDate}. Nothing to run.`);
      return;
    }

    // 2. Memory
    const notes = await getAllCurrentMemoryNotes();

    // 3. Claude
    const result = await runDailyIntelligence({ reportDate, visits, notes });
    if (!result) {
      await ctx.reply('❌ Claude run returned null. Check bot logs for details.');
      return;
    }

    // 4. Validate
    const validation = validateRunResult(result, { previousNotes: notes, visits });
    if (!validation.ok) {
      await ctx.reply(
        `❌ Validation failed: ${validation.reason}\n\nNothing written. Re-run with \`dry\` to preview.`,
        { parse_mode: 'Markdown' },
      );
      return;
    }

    // 5. Dry-run exit
    if (dryRun) {
      const preview = result.brief_markdown.slice(0, 1500);
      await ctx.reply(
        `*Dry-run preview* — ${visits.length} visits, ${result.note_updates.length} note updates, ${result.edges.length} edges.\n\n` +
          '```\n' +
          preview +
          (result.brief_markdown.length > 1500 ? '\n…(truncated)' : '') +
          '\n```\n\n_No DB writes, no broadcast._',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    // 6. Persist
    let notesWritten = 0;
    for (const note of result.note_updates) {
      const v = await insertMemoryNoteVersion(note);
      if (v !== null) notesWritten++;
    }
    await upsertMemoryEdges(result.edges);
    const report = await insertIntelligenceReport(reportDate, {
      brief_markdown: result.brief_markdown,
      stats: result.stats as unknown as Record<string, unknown>,
      visit_ids: visits.map((v) => v.id),
      model: result.model,
      prompt_tokens: result.prompt_tokens,
      completion_tokens: result.completion_tokens,
    });
    if (!report) {
      await ctx.reply('❌ Report insert failed. Memory notes are in DB but no report row exists.');
      return;
    }
    await markVisitsAnalyzed(visits.map((v) => v.id));

    // 7. Broadcast
    let sentCount = 0;
    let failedCount = 0;
    if (!skipTelegram) {
      const bcast = await broadcastIntelligenceBrief(result.brief_markdown);
      sentCount = bcast.sent;
      failedCount = bcast.failed.length;
    }

    await ctx.reply(
      `✅ *Brief generated for ${reportDate}* (v${report.version})\n\n` +
        `• Visits analyzed: *${visits.length}*\n` +
        `• Notes touched: *${notesWritten}/${result.note_updates.length}*\n` +
        `• Edges: *${result.edges.length}*\n` +
        `• Tokens: ${result.prompt_tokens} in / ${result.completion_tokens} out\n` +
        (skipTelegram
          ? '• Broadcast: _skipped_\n'
          : `• Broadcast: *${sentCount} sent*${failedCount > 0 ? `, ${failedCount} failed` : ''}\n`) +
        `\nView on dashboard: */intelligence*`,
      { parse_mode: 'Markdown' },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await ctx.reply(`❌ Run failed: \`${msg}\`\n\nCheck bot logs for the full stack.`, {
      parse_mode: 'Markdown',
    });
  }
}
