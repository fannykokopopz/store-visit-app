/**
 * Daily intelligence cron entry-point.
 *
 * Usage:
 *   npm run intelligence                        # today's report (SGT)
 *   npm run intelligence -- --date=2026-05-18   # backfill / re-run
 *   npm run intelligence -- --dry-run           # no DB writes, no Telegram, just prints
 *   npm run intelligence -- --skip-telegram     # writes DB but does not broadcast
 *
 * Flags can combine: --date=... --skip-telegram
 */

import {
  getVisitsForReportDate,
  getAllCurrentMemoryNotes,
  insertMemoryNoteVersion,
  upsertMemoryEdges,
  insertIntelligenceReport,
  markVisitsAnalyzed,
  acquireIntelligenceLock,
  releaseIntelligenceLock,
} from '../src/db/queries/intelligence.js';
import {
  runDailyIntelligence,
  validateRunResult,
} from '../src/ai/daily-intelligence.js';
import { broadcastIntelligenceBrief } from '../src/bot/broadcast-intelligence.js';

// ─── Flag parsing ─────────────────────────────────────────────────────────────

interface Flags {
  date: string;
  dryRun: boolean;
  skipTelegram: boolean;
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = {
    date: sgtToday(),
    dryRun: false,
    skipTelegram: false,
  };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--date=')) flags.date = arg.slice('--date='.length);
    else if (arg === '--dry-run') flags.dryRun = true;
    else if (arg === '--skip-telegram') flags.skipTelegram = true;
    else console.warn(`Unknown flag: ${arg}`);
  }
  return flags;
}

function sgtToday(): string {
  // Asia/Singapore is UTC+8 with no DST — compute from epoch
  const utc = Date.now();
  const sgt = new Date(utc + 8 * 60 * 60 * 1000);
  return sgt.toISOString().slice(0, 10);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const flags = parseFlags(process.argv);

  console.log('─'.repeat(70));
  console.log(`SVA Daily Intelligence — report_date=${flags.date}`);
  console.log(`  dry_run=${flags.dryRun}  skip_telegram=${flags.skipTelegram}`);
  console.log('─'.repeat(70));

  const lockAcquired = await acquireIntelligenceLock();
  if (!lockAcquired) {
    console.error('Could not acquire advisory lock — another run in progress?');
    process.exit(1);
  }

  try {
    // 1. Pull visits for this date
    const visits = await getVisitsForReportDate(flags.date);
    console.log(`Visits: ${visits.length} locked & unanalyzed for ${flags.date}`);
    if (visits.length === 0) {
      console.log('No visits — nothing to report. Exiting.');
      return;
    }

    // 2. Pull current memory
    const notes = await getAllCurrentMemoryNotes();
    console.log(`Memory: ${notes.length} current notes`);

    // 3. Call Claude
    console.log('Calling Claude…');
    const result = await runDailyIntelligence({
      reportDate: flags.date,
      visits,
      notes,
    });
    if (!result) {
      console.error('Intelligence run returned null. Aborting.');
      process.exit(2);
    }
    console.log(
      `Claude returned: model=${result.model} prompt_tokens=${result.prompt_tokens} completion_tokens=${result.completion_tokens}`,
    );

    // 4. Validate
    const validation = validateRunResult(result, {
      previousNotes: notes,
      visits,
    });
    if (validation.warnings.length > 0) {
      console.warn('Validation warnings:');
      for (const w of validation.warnings) console.warn(`  - ${w}`);
    }
    if (!validation.ok) {
      console.error(`Validation failed: ${validation.reason}`);
      console.error('Not writing to DB. Brief preview below:');
      console.error('─'.repeat(70));
      console.error(result.brief_markdown.slice(0, 1000));
      process.exit(3);
    }

    // 5. Dry-run: print and exit
    if (flags.dryRun) {
      console.log('─'.repeat(70));
      console.log('DRY RUN — output:');
      console.log('─'.repeat(70));
      console.log(result.brief_markdown);
      console.log('─'.repeat(70));
      console.log(`Notes to update/create: ${result.note_updates.length}`);
      console.log(`Edges to upsert: ${result.edges.length}`);
      console.log('Themes promoted:', result.stats.themes_promoted);
      console.log('New notes:', result.stats.new_notes);
      console.log('─'.repeat(70));
      console.log('DRY RUN — nothing written to DB, nothing sent.');
      return;
    }

    // 6. Persist notes
    let notesWritten = 0;
    for (const note of result.note_updates) {
      const v = await insertMemoryNoteVersion(note);
      if (v !== null) notesWritten++;
    }
    console.log(`Notes written: ${notesWritten}/${result.note_updates.length}`);

    // 7. Persist edges
    const edgesOk = await upsertMemoryEdges(result.edges);
    console.log(`Edges upserted: ${result.edges.length} (ok=${edgesOk})`);

    // 8. Persist report
    const report = await insertIntelligenceReport(flags.date, {
      brief_markdown: result.brief_markdown,
      stats: result.stats as unknown as Record<string, unknown>,
      visit_ids: visits.map((v) => v.id),
      model: result.model,
      prompt_tokens: result.prompt_tokens,
      completion_tokens: result.completion_tokens,
    });
    if (!report) {
      console.error('Report insert failed. Aborting before mark-analyzed + broadcast.');
      process.exit(4);
    }
    console.log(`Report inserted: id=${report.id} version=${report.version}`);

    // 9. Mark visits analyzed
    const marked = await markVisitsAnalyzed(visits.map((v) => v.id));
    console.log(`Marked ${visits.length} visits analyzed (ok=${marked})`);

    // 10. Broadcast (unless skipped)
    if (flags.skipTelegram) {
      console.log('--skip-telegram set — not broadcasting.');
    } else {
      console.log('Broadcasting to intelligence recipients…');
      const bcast = await broadcastIntelligenceBrief(result.brief_markdown);
      console.log(`Broadcast: sent=${bcast.sent} failed=${bcast.failed.length}`);
      if (bcast.failed.length > 0) {
        for (const f of bcast.failed) {
          console.warn(`  failed to ${f.telegram_id}: ${f.error}`);
        }
      }
    }

    console.log('─'.repeat(70));
    console.log('Done.');
  } finally {
    await releaseIntelligenceLock();
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(99);
});
