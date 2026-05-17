"use client";

import { useEffect, useMemo, useState } from "react";
import { initTelegram } from "../../telegram-init";

// ── Types ────────────────────────────────────────────────────────────────────

interface Whoami {
  name: string;
  nickname: string | null;
  role: "cm" | "cmic" | "am" | "admin";
  market: string;
}

interface Activity {
  visits: { date: string; store_id: string; store_name: string }[];
  trainings: { date: string; store_id: string; store_name: string; staff_count: number }[];
}

type Preset = "lifetime" | "this-week" | "this-month" | "last-month" | "quarter";

type AppliedFilter =
  | { mode: "preset"; preset: Preset }
  | { mode: "weeks"; weeks: string[] };

// ── Date helpers (mirror mockup) ─────────────────────────────────────────────

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayISO(): string { return toISO(new Date()); }

function weekStart(iso: string): string {
  const d = parseISO(iso);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  return toISO(d);
}
function weekEnd(weekStartIso: string): string {
  const d = parseISO(weekStartIso);
  d.setDate(d.getDate() + 6);
  return toISO(d);
}
function isoWeek(iso: string): number {
  const d = parseISO(iso);
  const target = new Date(d);
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstThursdayDayNr = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstThursdayDayNr + 3);
  const diff = (target.getTime() - firstThursday.getTime()) / 86400000;
  return 1 + Math.round(diff / 7);
}
function weekRangeLabel(weekStartIso: string): string {
  const start = parseISO(weekStartIso);
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const fmtMonth = (d: Date) => d.toLocaleDateString("en-GB", { month: "short" });
  if (sameMonth) return `${start.getDate()}–${end.getDate()} ${fmtMonth(end)}`;
  return `${start.getDate()} ${fmtMonth(start)} – ${end.getDate()} ${fmtMonth(end)}`;
}

function presetRange(preset: Preset): [string | null, string | null] {
  const today = todayISO();
  if (preset === "lifetime") return [null, null];
  if (preset === "this-week") return [weekStart(today), weekEnd(weekStart(today))];
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  if (preset === "this-month") {
    const start = toISO(new Date(y, m, 1));
    const end = toISO(new Date(y, m + 1, 0));
    return [start, end];
  }
  if (preset === "last-month") {
    const start = toISO(new Date(y, m - 1, 1));
    const end = toISO(new Date(y, m, 0));
    return [start, end];
  }
  if (preset === "quarter") {
    const qStartMonth = Math.floor(m / 3) * 3;
    const start = toISO(new Date(y, qStartMonth, 1));
    const end = toISO(new Date(y, qStartMonth + 3, 0));
    return [start, end];
  }
  return [null, null];
}

function filterRange(f: AppliedFilter): [string | null, string | null] {
  if (f.mode === "preset") return presetRange(f.preset);
  if (f.weeks.length === 0) return [null, null];
  const sorted = [...f.weeks].sort();
  return [sorted[0], weekEnd(sorted[sorted.length - 1])];
}

const PRESET_LABELS: Record<string, string> = {
  "lifetime": "Lifetime",
  "this-week": "This week",
  "this-month": "This month",
  "last-month": "Last month",
  "quarter": "This quarter",
};

function describeFilter(f: AppliedFilter): string {
  if (f.mode === "preset") return PRESET_LABELS[f.preset] ?? "Lifetime";
  if (f.weeks.length === 0) return "Lifetime";
  if (f.weeks.length === 1) return `Week ${isoWeek(f.weeks[0])} · ${weekRangeLabel(f.weeks[0])}`;
  const isoNums = f.weeks.map(isoWeek).sort((a, b) => a - b);
  const contiguous = isoNums.every((n, i) => i === 0 || n === isoNums[i - 1] + 1);
  if (contiguous) return `Weeks ${isoNums[0]}–${isoNums[isoNums.length - 1]}`;
  return `${f.weeks.length} weeks selected`;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const [whoami, setWhoami] = useState<Whoami | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appliedFilter] = useState<AppliedFilter>({ mode: "preset", preset: "lifetime" });
  const [visitsOpen, setVisitsOpen] = useState(true);
  const [trainingsOpen, setTrainingsOpen] = useState(false);

  // Load whoami once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initTelegram();
        const initData = window.Telegram?.WebApp?.initData ?? "";
        const res = await fetch("/api/m/whoami", { headers: { "x-tg-init-data": initData } });
        if (!res.ok) throw new Error(`whoami: ${res.status}`);
        const json: Whoami = await res.json();
        if (!cancelled) setWhoami(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load profile");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Refetch activity when filter changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initTelegram();
        const initData = window.Telegram?.WebApp?.initData ?? "";
        const [from, to] = filterRange(appliedFilter);
        const params = new URLSearchParams();
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        const url = `/api/m/stats/activity${params.toString() ? `?${params}` : ""}`;
        const res = await fetch(url, { headers: { "x-tg-init-data": initData } });
        if (!res.ok) throw new Error(`activity: ${res.status}`);
        const json: Activity = await res.json();
        if (!cancelled) setActivity(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load activity");
      }
    })();
    return () => { cancelled = true; };
  }, [appliedFilter]);

  const displayName = whoami?.nickname ?? whoami?.name ?? "—";
  const roleLabel = whoami ? whoami.role.toUpperCase() : "";

  const totals = useMemo(() => {
    if (!activity) return { visitCount: 0, storesCovered: 0, trainStaff: 0, trainSessions: 0 };
    const storeSet = new Set(activity.visits.map((v) => v.store_id));
    const staffTotal = activity.trainings.reduce((s, t) => s + (t.staff_count || 1), 0);
    return {
      visitCount: activity.visits.length,
      storesCovered: storeSet.size,
      trainStaff: staffTotal,
      trainSessions: activity.trainings.length,
    };
  }, [activity]);

  const filterLabel = describeFilter(appliedFilter);
  const filterActive = !(appliedFilter.mode === "preset" && appliedFilter.preset === "lifetime");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-[18px] pt-[22px] pb-4 bg-white border-b border-[var(--color-ink-100)]">
        <div className="flex justify-between items-baseline">
          <div className="text-[26px] font-black text-[var(--color-ink-700)] leading-none tracking-tight">Stats</div>
          <div className="text-[11px] font-semibold text-[var(--color-ink-300)]">
            {displayName} {roleLabel && <span>· {roleLabel}</span>}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-[100px]">
        {error && (
          <div className="mx-[14px] mt-4 p-4 rounded-xl border border-[var(--color-status-bad-bg)] bg-[var(--color-status-bad-bg)] text-[var(--color-status-bad-fg)] text-sm">
            {error}
          </div>
        )}

        {/* Performance — placeholder */}
        <SectionLabel>Performance</SectionLabel>
        <div className="mx-[14px] mt-1 rounded-2xl border border-dashed border-[var(--color-ink-200)] bg-white p-4 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--color-tc-50)] text-[var(--color-tc-400)] text-lg mb-2">📈</div>
          <div className="text-[13px] font-extrabold text-[var(--color-ink-700)] tracking-tight">Insights coming soon</div>
          <div className="text-[11px] text-[var(--color-ink-500)] leading-relaxed mt-0.5">Trends, coverage scores, comparisons &amp; more.</div>
          <div className="flex gap-1.5 flex-wrap justify-center mt-2.5">
            {["Coverage", "Streaks", "Trends"].map((c) => (
              <span key={c} className="text-[9px] font-bold uppercase tracking-wider bg-[var(--color-ink-100)] text-[var(--color-ink-500)] px-2.5 py-1 rounded-full">{c}</span>
            ))}
          </div>
        </div>

        {/* Activity */}
        <SectionLabel>Activity</SectionLabel>

        <div className="mx-[14px] mt-1 mb-3">
          <button
            type="button"
            disabled
            className={`w-full flex items-center justify-between rounded-xl px-3 py-2 border shadow-[0_1px_3px_rgba(0,0,0,0.04)] cursor-not-allowed ${
              filterActive
                ? "border-[var(--color-tc-400)] bg-[var(--color-tc-50)]"
                : "border-[var(--color-ink-100)] bg-white"
            }`}
            aria-label="Filter (coming soon)"
          >
            <div className="text-left">
              <div className="text-[8px] font-bold uppercase tracking-widest text-[var(--color-ink-300)]">Showing</div>
              <div className={`text-[12px] font-bold mt-0.5 ${filterActive ? "text-[var(--color-ink-700)]" : "text-[var(--color-ink-500)]"}`}>{filterLabel}</div>
            </div>
            <div className="text-[var(--color-ink-300)] text-[13px]">›</div>
          </button>
        </div>

        {activity && (
          <>
            <SummaryCard
              icon="📍"
              iconBg="bg-[var(--color-tier-t1-bg)]"
              label="Store visits"
              valueMain={String(totals.visitCount)}
              valueSub={`across ${totals.storesCovered} ${totals.storesCovered === 1 ? "store" : "stores"}`}
              open={visitsOpen}
              onToggle={() => setVisitsOpen((v) => !v)}
            >
              <Timeline items={activity.visits.map((v) => ({ date: v.date, store_name: v.store_name }))} kind="visit" />
            </SummaryCard>

            <SummaryCard
              icon="🎓"
              iconBg="bg-[var(--color-section-purple-bg)]"
              label="Trainings"
              valueMain={`${totals.trainStaff} staff`}
              valueSub={`· ${totals.trainSessions} ${totals.trainSessions === 1 ? "session" : "sessions"}`}
              open={trainingsOpen}
              onToggle={() => setTrainingsOpen((t) => !t)}
            >
              <Timeline items={activity.trainings.map((t) => ({ date: t.date, store_name: t.store_name, meta: `${t.staff_count} staff` }))} kind="training" />
            </SummaryCard>
          </>
        )}

        {!activity && !error && (
          <div className="py-10 text-center text-[var(--color-ink-300)] text-sm">Loading…</div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--color-ink-300)] px-[18px] pt-[18px] pb-1">
      {children}
    </div>
  );
}

function SummaryCard({
  icon,
  iconBg,
  label,
  valueMain,
  valueSub,
  open,
  onToggle,
  children,
}: {
  icon: string;
  iconBg: string;
  label: string;
  valueMain: string;
  valueSub: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-[14px] mt-2.5 bg-white border border-[var(--color-ink-100)] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <button type="button" onClick={onToggle} className="w-full px-4 py-3.5 flex items-center gap-3 text-left">
        <div className={`w-[42px] h-[42px] rounded-xl flex items-center justify-center text-[19px] flex-shrink-0 ${iconBg}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-300)] mb-0.5">{label}</div>
          <div className="text-[22px] font-black text-[var(--color-ink-700)] leading-none tracking-tight">
            {valueMain}
            <span className="text-[13px] font-semibold text-[var(--color-ink-500)] ml-1">{valueSub}</span>
          </div>
        </div>
        <div className={`text-[var(--color-ink-300)] text-[22px] transition-transform flex-shrink-0 ${open ? "rotate-90" : ""}`}>›</div>
      </button>
      {open && <div className="border-t border-[var(--color-ink-100)]">{children}</div>}
    </div>
  );
}

interface TimelineEntry {
  date: string;
  store_name: string;
  meta?: string;
}

function Timeline({ items, kind }: { items: TimelineEntry[]; kind: "visit" | "training" }) {
  if (items.length === 0) {
    return (
      <div className="py-6 text-center text-[var(--color-ink-300)] text-[12px] italic">
        No {kind === "visit" ? "visits" : "trainings"} in this period
      </div>
    );
  }
  const groups = new Map<string, TimelineEntry[]>();
  for (const it of items) {
    const wk = weekStart(it.date);
    const arr = groups.get(wk) ?? [];
    arr.push(it);
    groups.set(wk, arr);
  }
  const weeks = Array.from(groups.keys()).sort().reverse();

  return (
    <>
      {weeks.map((wk) => {
        const entries = (groups.get(wk) ?? []).sort((a, b) => b.date.localeCompare(a.date));
        const count = kind === "visit"
          ? `${entries.length} visit${entries.length > 1 ? "s" : ""}`
          : `${entries.reduce((s, e) => {
              const n = parseInt((e.meta?.match(/^\d+/) ?? ["1"])[0], 10);
              return s + (Number.isFinite(n) ? n : 1);
            }, 0)} staff`;
        return (
          <div key={wk}>
            <div className="px-4 py-2 bg-[var(--color-ink-50)] border-y border-[var(--color-ink-100)] flex justify-between items-center">
              <span className="flex items-baseline gap-1.5">
                <span className="text-[11px] font-extrabold text-[var(--color-ink-700)]">Week {isoWeek(wk)}</span>
                <span className="text-[10px] font-semibold text-[var(--color-ink-500)]">· {weekRangeLabel(wk)}</span>
              </span>
              <span className="text-[10px] font-bold text-[var(--color-ink-700)] bg-white border border-[var(--color-ink-100)] px-2 py-px rounded-full">
                {count}
              </span>
            </div>
            {entries.map((e, i) => {
              const d = parseISO(e.date);
              const dow = d.toLocaleDateString("en-GB", { weekday: "short" });
              const dateStr = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
              return (
                <div key={`${e.date}-${e.store_name}-${i}`} className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--color-ink-50)] last:border-b-0 text-[13px]">
                  <div className="w-14 flex-shrink-0">
                    <div className="text-[9px] font-bold text-[var(--color-ink-300)] uppercase tracking-wider">{dow}</div>
                    <div className="text-[11px] font-bold text-[var(--color-ink-500)]">{dateStr}</div>
                  </div>
                  <div className="flex-1 min-w-0 text-[var(--color-ink-700)] font-semibold truncate">{e.store_name || "—"}</div>
                  {e.meta && <div className="text-[10px] font-semibold text-[var(--color-ink-300)] flex-shrink-0">{e.meta}</div>}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
