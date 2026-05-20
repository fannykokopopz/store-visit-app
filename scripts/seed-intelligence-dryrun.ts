/**
 * Seed the intelligence layer with the 2026-05-18 dry-run output so the
 * dashboard has real-looking content before the actual cron runs against the
 * Anthropic API. Idempotent: safe to re-run (each insert creates a new version
 * if one already exists for that slug/date).
 *
 * Run:
 *   cd tc-sva-bot
 *   npm install   # if you haven't
 *   npx tsx scripts/seed-intelligence-dryrun.ts
 */

import { supabase } from '../src/db/client.js';
import {
  insertMemoryNoteVersion,
  upsertMemoryEdges,
  insertIntelligenceReport,
  type MemoryNoteWrite,
  type MemoryEdgeWrite,
} from '../src/db/queries/intelligence.js';

const REPORT_DATE = '2026-05-18';

// ─── 1. Brief markdown (dashboard view, with tables) ─────────────────────────

const BRIEF_MARKDOWN = `# 📍 Daily Intelligence Brief — 18 May 2026

## 🎯 Today's signal
- Bose's new-soundbar rollout hit its **5th store** today (BD Vivo, via Damian)
- Sarwes independently confirms the **cabling-quality issue** — same pattern at BD Vivo, Heeren, Megastore
- **3 sources, 3 chains** — Bose execution is consistently weak right now
- → Competitive comparison training window is wide open

## 🟢 Wins

| Where | What | Who |
|---|---|---|
| Harvey Parkway | Bulk Sonos B2B — airport customer, office use | Mun |
| BD Vivo | Sonos popup confirmed for active period | Damian |
| Harvey MW | Furniture + TV DH loan secured | Johnathan |
| BD NAC | 3 Marshall Middletons closed in one transaction | (staff) |

## 🔴 Competitor moves

| Brand | Move | Where | Source |
|---|---|---|---|
| Bose | New soundbar popup, 2-week space, weak cabling | BD Vivo | Sarwes |
| Bose | Popup setup "super low effort" | Courts Megastore | Jerome |
| JBL | Promoter back to 6-day week (noon–close) | Courts Megastore | Jerome |
| JBL | Plays loud music during Sonos demos | Courts Megastore | Sunny |
| Sony | Roadshow same period as ours (25 May–7 Jun) | Courts Heeren | Jerome |
| Samsung | Conquering TV + electronics space | Courts Heeren | Jerome |
| Marshall | Outselling other brands' home speakers | Courts Heeren | Jerome |

## 🟡 Watch
- **Harvey Parkway:** Ben hesitant to deepen stock — FY ends June
- **BD NAC:** Taka voucher nego collapsed; crowd issue persistent
- **Courts Heeren:** stock low — Adrian notified
- **Courts Megastore:** Sunny says Homeowner's Club promo (2.9k subs, half repeat) is gimmick

## 🧵 Threads
- **Bose execution-quality** — 5 visits / 14 days, 4 stores
- **Roadshow convergence May–Jun** — 4 visits, Heeren + Megastore battle zone
- **Marshall momentum** — promoted today (2nd store)
- **Channel-anxiety** — promoted today (3 chains)

---

*7 visits · 2 CMs (Johnathan, Jerome) · 7 outlets · Key people today: Damian, Sunny, Ben, Mun, Sarwes*
`;

// ─── 2. Resolve real store UUIDs where available ─────────────────────────────

async function resolveStoreId(namePattern: string): Promise<string | null> {
  const { data } = await supabase
    .from('stores')
    .select('id, name')
    .ilike('name', `%${namePattern}%`)
    .limit(1);
  return data?.[0]?.id ?? null;
}

// ─── 3. Memory notes ─────────────────────────────────────────────────────────

async function buildNotes(): Promise<MemoryNoteWrite[]> {
  const [bdVivo, bdNac, bdPs, heeren, megastore, harveyMw, harveyParkway] =
    await Promise.all([
      resolveStoreId('Vivo'),
      resolveStoreId('NAC'),
      resolveStoreId('Plaza Sing'),
      resolveStoreId('Heeren'),
      resolveStoreId('Megastore'),
      resolveStoreId('Marina'),
      resolveStoreId('Parkway'),
    ]);

  const storeRef = (uuid: string | null, fallbackSlug: string) => uuid ?? fallbackSlug;

  return [
    // ── Themes ─────────────────────────────────────────────────
    {
      slug: 'theme:bose-popup-rollout',
      scope: 'theme',
      scope_ref: 'bose-popup-rollout',
      title: 'Bose new-soundbar rollout',
      summary:
        "Bose rolling out new soundbar across multiple stores; execution quality consistently weak.",
      body_markdown: `**Active across:** BD Vivo, Courts Heeren, Courts Megastore, Harvey MW
**Cadence:** 5 visits across 14 days

**Quality issues flagged (3 chains, 3 independent sources):**
- Cabling — Sarwes @ BD Vivo, 2026-05-18
- Display quality — Jerome @ Heeren, 2026-05-12
- Low-effort setup — Jerome @ Megastore, 2026-05-15
- Promoter friction — Johnathan @ Harvey MW, 2026-05-15

**Implication:** Competitive comparison training window is open while execution stays weak.
`,
      related_slugs: [
        `store:${storeRef(bdVivo, 'bd-vivo')}`,
        `store:${storeRef(heeren, 'courts-heeren')}`,
        `store:${storeRef(megastore, 'courts-megastore')}`,
        `store:${storeRef(harveyMw, 'harvey-mw')}`,
        'theme:roadshow-convergence-may-jun',
      ],
    },
    {
      slug: 'theme:marshall-momentum',
      scope: 'theme',
      scope_ref: 'marshall-momentum',
      title: 'Marshall momentum building',
      summary:
        'Marshall outperforming peer home speakers; closing strong at Best Denki and Courts.',
      body_markdown: `**Promoted from watching → active 2026-05-18** (2nd store with momentum signal)

- BD NAC (2026-05-14): staff closed 3 Middletons in one transaction
- Courts Heeren (2026-05-12): Jerome notes Marshall outselling other brands' home speakers

**Cadence:** 2 visits across 4 days.
`,
      related_slugs: [
        `store:${storeRef(bdNac, 'bd-nac')}`,
        `store:${storeRef(heeren, 'courts-heeren')}`,
      ],
    },
    {
      slug: 'theme:channel-anxiety',
      scope: 'theme',
      scope_ref: 'channel-anxiety',
      title: 'Channel partners signalling caution',
      summary:
        'Stocking conservatism, traffic concerns, promo skepticism across 3 different chains.',
      body_markdown: `**Promoted from watching → active 2026-05-18** (3 chains, 3 distinct sources)

- Harvey Parkway (2026-05-18): Ben hesitant to load deeper — Harvey FY ends June, WOI concern
- BD NAC (2026-05-14): Taka voucher nego collapsed (Taka demanded sponsorship + cut); crowd issue persistent
- Courts Megastore (2026-05-15): Sunny flags Homeowner's Club promo as gimmick — 2.9k subs, half repeat

Pattern: posture is consistent across chains, not a one-off.
`,
      related_slugs: [
        `store:${storeRef(harveyParkway, 'harvey-parkway')}`,
        `store:${storeRef(bdNac, 'bd-nac')}`,
        `store:${storeRef(megastore, 'courts-megastore')}`,
        'person:ben',
        'person:sunny',
      ],
    },
    {
      slug: 'theme:b2b-vertical-signals',
      scope: 'theme',
      scope_ref: 'b2b-vertical-signals',
      title: 'B2B / office vertical emerging',
      summary: 'B2B / office-use buying pattern emerging. On watching list — 1 visit so far.',
      body_markdown: `**On watching list — promote if a 2nd surfaces within 14 days.**

- Harvey Parkway (2026-05-18): Mun closed bulk Sonos — airport customer buying for office use
`,
      related_slugs: [
        `store:${storeRef(harveyParkway, 'harvey-parkway')}`,
        'person:mun',
      ],
    },

    // ── Stores ─────────────────────────────────────────────────
    {
      slug: `store:${storeRef(bdVivo, 'bd-vivo')}`,
      scope: 'store',
      scope_ref: storeRef(bdVivo, 'bd-vivo'),
      title: 'Best Denki Vivo',
      summary:
        'Sonos popup active partner via Damian; Sarwes is reliable competitor-intel ally.',
      body_markdown: `**Key relationships:** Damian (popup point person) · Sarwes (competitor-intel ally)

**Recent context:**
- 2026-05-18 (Johnathan): Sonos popup confirmed w/ Damian
- 2026-05-18 (via Sarwes): Bose 2-week space; cabling weak — feeds theme:bose-popup-rollout

**Open threads:** Sonos popup execution this period.
`,
      related_slugs: ['theme:bose-popup-rollout', 'person:damian', 'person:sarwes'],
    },
    {
      slug: `store:${storeRef(bdNac, 'bd-nac')}`,
      scope: 'store',
      scope_ref: storeRef(bdNac, 'bd-nac'),
      title: 'Best Denki NAC',
      summary:
        'Tier-A urban store. Persistent crowd concern; Marshall momentum building.',
      body_markdown: `**Standing context:** Crowd / footfall is the persistent concern at this store.

**Recent context:**
- 2026-05-14 (Johnathan): Marshall — 3 Middletons in one transaction (staff close)
- 2026-05-14 (Johnathan): Taka voucher nego collapsed (Taka demanded sponsorship + cut)
- 2026-05-14 (Johnathan): TV sales weak — high value but low quantity

**Open threads:** Crowd issue persists with no path forward.
`,
      related_slugs: ['theme:marshall-momentum', 'theme:channel-anxiety'],
    },
    {
      slug: `store:${storeRef(harveyParkway, 'harvey-parkway')}`,
      scope: 'store',
      scope_ref: storeRef(harveyParkway, 'harvey-parkway'),
      title: 'Harvey Norman Parkway',
      summary:
        'Lower traffic. Ben is relationship-led, stock-cautious; Mun closing well.',
      body_markdown: `**Standing context:** Lower-traffic store. Partner Ben prefers slow-and-steady stocking.

**Recent context:**
- 2026-05-18 (Johnathan): Ben loading popup but hesitant to deepen stock — Harvey FY ends June (WOI concern)
- 2026-05-18 (Mun): Bulk Sonos B2B — airport customer for office use
- 2026-05-18 (Mun): Return-customer beam set closed

**Open threads:** B&W headphones stands display follow-up.
`,
      related_slugs: ['theme:channel-anxiety', 'theme:b2b-vertical-signals', 'person:ben', 'person:mun'],
    },

    // ── People ─────────────────────────────────────────────────
    {
      slug: 'person:sunny',
      scope: 'person',
      scope_ref: 'sunny',
      title: 'Sunny — Courts Megastore',
      summary:
        'Sharp competitor intel + retailer-side dynamics. High-value portfolio ally.',
      body_markdown: `**Store:** Courts Megastore
**Strength:** Surfaces competitor execution and retailer-side dynamics ahead of others.

**Recent intel:**
- 2026-05-15: JBL plays loud music during Sonos demos (tactical signal)
- 2026-05-15: Homeowner's Club promo is gimmick — 2.9k subs, half repeat customers

**Relationship:** treat as portfolio asset — keep informed.
`,
      related_slugs: [
        `store:${storeRef(megastore, 'courts-megastore')}`,
        'theme:bose-popup-rollout',
        'theme:channel-anxiety',
      ],
    },
    {
      slug: 'person:ben',
      scope: 'person',
      scope_ref: 'ben',
      title: 'Ben — Harvey Parkway',
      summary:
        'Relationship-led, stock-cautious. Needs reassurance, not pressure.',
      body_markdown: `**Store:** Harvey Parkway

**Recent context:**
- 2026-05-18: Loading popup, hesitant to deepen stock — Harvey FY ends June (WOI concern)

**Approach:** relationship-led; pressuring on stock will backfire. Reassure on sell-through plans.
`,
      related_slugs: [
        `store:${storeRef(harveyParkway, 'harvey-parkway')}`,
        'theme:channel-anxiety',
      ],
    },
    {
      slug: 'person:damian',
      scope: 'person',
      scope_ref: 'damian',
      title: 'Damian — BD Vivo',
      summary: 'Sonos popup point person at BD Vivo. Active partner.',
      body_markdown: `**Store:** Best Denki Vivo

**Recent context:**
- 2026-05-18: Sonos popup confirmed for active period.

**Role:** Operational owner of Sonos popups at this outlet.
`,
      related_slugs: [`store:${storeRef(bdVivo, 'bd-vivo')}`, 'theme:bose-popup-rollout'],
    },
    {
      slug: 'person:mun',
      scope: 'person',
      scope_ref: 'mun',
      title: 'Mun — Harvey Parkway',
      summary:
        'Closed bulk B2B + return-customer beam set in one period. Sales momentum.',
      body_markdown: `**Store:** Harvey Parkway

**Recent wins:**
- 2026-05-18: Bulk Sonos B2B — airport customer for office use (first B2B/vertical signal in portfolio)
- 2026-05-18: Return-customer beam set closed
`,
      related_slugs: [
        `store:${storeRef(harveyParkway, 'harvey-parkway')}`,
        'theme:b2b-vertical-signals',
      ],
    },
    {
      slug: 'person:sarwes',
      scope: 'person',
      scope_ref: 'sarwes',
      title: 'Sarwes — BD Vivo',
      summary:
        'Reliable competitor-intel source — confirms Bose cabling pattern across stores.',
      body_markdown: `**Store:** Best Denki Vivo
**Strength:** Pre-emptively flags competitor execution issues.

**Recent intel:**
- 2026-05-18: Bose 2-week popup at BD Vivo — weak cabling. Independent confirmation of pattern seen at Heeren / Megastore.
`,
      related_slugs: [`store:${storeRef(bdVivo, 'bd-vivo')}`, 'theme:bose-popup-rollout'],
    },
  ];
}

// ─── 4. Edges derived from related_slugs ─────────────────────────────────────

function edgesFromNotes(notes: MemoryNoteWrite[]): MemoryEdgeWrite[] {
  const edges: MemoryEdgeWrite[] = [];
  for (const note of notes) {
    for (const target of note.related_slugs) {
      const a = note.slug;
      const b = target;
      const aScope = a.split(':')[0];
      const bScope = b.split(':')[0];

      let edgeType: MemoryEdgeWrite['edge_type'] | null = null;
      const pair = [aScope, bScope].sort().join('_');
      if (pair === 'store_theme') edgeType = 'store_theme';
      else if (pair === 'person_store') edgeType = 'person_store';
      else if (pair === 'person_theme') edgeType = 'person_theme';
      else if (pair === 'theme_theme') edgeType = 'theme_theme';

      if (!edgeType) continue;
      // Canonical direction: alphabetical for dedup
      const [from, to] = [a, b].sort();
      edges.push({ from_slug: from, to_slug: to, edge_type: edgeType });
    }
  }
  // Dedup
  const seen = new Set<string>();
  return edges.filter((e) => {
    const k = `${e.from_slug}|${e.to_slug}|${e.edge_type}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding intelligence layer with dry-run data…');

  const notes = await buildNotes();
  console.log(`Inserting ${notes.length} memory notes…`);
  for (const note of notes) {
    const v = await insertMemoryNoteVersion(note);
    console.log(`  ${note.slug} → v${v}`);
  }

  const edges = edgesFromNotes(notes);
  console.log(`Upserting ${edges.length} edges…`);
  await upsertMemoryEdges(edges);

  console.log(`Inserting intelligence report for ${REPORT_DATE}…`);
  const report = await insertIntelligenceReport(REPORT_DATE, {
    brief_markdown: BRIEF_MARKDOWN,
    stats: {
      themes_active: 3,
      themes_promoted: ['theme:marshall-momentum', 'theme:channel-anxiety'],
      notes_touched: notes.length,
      new_notes: [
        'theme:marshall-momentum',
        'theme:channel-anxiety',
        'theme:b2b-vertical-signals',
        'person:mun',
        'person:sarwes',
      ],
      visits_count: 7,
      cms_count: 2,
      outlets_count: 7,
    },
    visit_ids: [],
    model: 'claude-sonnet-4-6 (manual dry-run)',
    prompt_tokens: null,
    completion_tokens: null,
  });

  if (report) {
    console.log(`  Report id=${report.id} version=${report.version}`);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
