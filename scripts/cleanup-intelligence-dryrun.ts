/**
 * Tear down the dry-run data inserted by seed-intelligence-dryrun.ts.
 * Safe to run repeatedly: deletes by exact slug + report_date.
 *
 * Removes:
 *   - sva.intelligence_reports rows for 2026-05-18 (all versions)
 *   - sva.memory_notes rows for the 12 seeded slugs (all versions)
 *   - sva.memory_edges rows referencing those slugs
 *
 * Real cron runs are untouched: they create different slugs and different dates.
 *
 * Run:
 *   npm run intelligence:cleanup
 */

import { supabase } from '../src/db/client.js';

const REPORT_DATE = '2026-05-18';

const FIXED_SLUGS = [
  // themes
  'theme:bose-popup-rollout',
  'theme:marshall-momentum',
  'theme:channel-anxiety',
  'theme:b2b-vertical-signals',
  // people
  'person:sunny',
  'person:ben',
  'person:damian',
  'person:mun',
  'person:sarwes',
];

async function resolveStoreSlug(namePattern: string, fallback: string): Promise<string> {
  const { data } = await supabase
    .from('stores')
    .select('id')
    .ilike('name', `%${namePattern}%`)
    .limit(1);
  const uuid = data?.[0]?.id;
  return `store:${uuid ?? fallback}`;
}

async function main() {
  console.log(`Cleaning up intelligence dry-run data (report_date=${REPORT_DATE})…`);

  const storeSlugs = await Promise.all([
    resolveStoreSlug('Vivo', 'bd-vivo'),
    resolveStoreSlug('NAC', 'bd-nac'),
    resolveStoreSlug('Parkway', 'harvey-parkway'),
  ]);

  const allSlugs = [...FIXED_SLUGS, ...storeSlugs];
  console.log(`Targeting ${allSlugs.length} slugs:`);
  for (const s of allSlugs) console.log(`  ${s}`);

  // 1. Delete edges referencing any of these slugs (two passes — simpler than .or with colon-bearing values)
  const { error: edgeFromErr, count: edgeFromCount } = await supabase
    .from('memory_edges')
    .delete({ count: 'exact' })
    .in('from_slug', allSlugs);
  if (edgeFromErr) console.error('  edge (from) delete error:', edgeFromErr.message);

  const { error: edgeToErr, count: edgeToCount } = await supabase
    .from('memory_edges')
    .delete({ count: 'exact' })
    .in('to_slug', allSlugs);
  if (edgeToErr) console.error('  edge (to) delete error:', edgeToErr.message);

  console.log(`  Deleted ${(edgeFromCount ?? 0) + (edgeToCount ?? 0)} edges`);

  // 2. Delete memory notes by slug (all versions)
  const { error: noteErr, count: noteCount } = await supabase
    .from('memory_notes')
    .delete({ count: 'exact' })
    .in('slug', allSlugs);
  if (noteErr) console.error('  note delete error:', noteErr.message);
  else console.log(`  Deleted ${noteCount ?? 0} memory_note rows`);

  // 3. Delete the report for that date (all versions)
  const { error: reportErr, count: reportCount } = await supabase
    .from('intelligence_reports')
    .delete({ count: 'exact' })
    .eq('report_date', REPORT_DATE);
  if (reportErr) console.error('  report delete error:', reportErr.message);
  else console.log(`  Deleted ${reportCount ?? 0} intelligence_report rows`);

  console.log('Done.');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
