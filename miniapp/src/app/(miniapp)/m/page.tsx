"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { initTelegram } from "./telegram-init";

interface PortfolioStore {
  id: string;
  name: string;
  chain: string;
  tier: "T1" | "T2" | "T3" | "T4" | null;
  last_visit_date: string | null;
  last_visit_id: string | null;
  visits_30d: number;
}

interface Portfolio {
  cm: { name: string; market: string };
  stores: PortfolioStore[];
}

// Days before a store is considered overdue, by tier
const OVERDUE_DAYS: Record<string, number> = {
  T1: 7,
  T2: 14,
  T3: 30,
  T4: 90,
};

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const then = new Date(dateStr);
  then.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - then.getTime()) / 86400000);
}

function lastVisitLabel(dateStr: string | null): string {
  const days = daysSince(dateStr);
  if (days === null) return "Never visited";
  if (days <= 0) return "Visited today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Over a week ago";
  if (days < 30) return "Over 2 weeks ago";
  if (days < 60) return "Over a month ago";
  return "Over 2 months ago";
}

function visitAgoClass(dateStr: string | null, tier: string | null): string {
  const days = daysSince(dateStr);
  if (days === null) return "text-ink-300";
  if (days <= 1) return "text-[var(--color-tier-t2-fg)] font-semibold";
  const threshold = tier ? (OVERDUE_DAYS[tier] ?? 14) : 14;
  if (days > threshold) return "text-[var(--color-status-bad-fg)] font-semibold";
  if (days > threshold * 0.7) return "text-[var(--color-status-warn-fg)] font-semibold";
  return "text-ink-400 font-medium";
}

const TIER_STYLE: Record<string, string> = {
  T1: "bg-[var(--color-tier-t1-bg)] text-[var(--color-tier-t1-fg)]",
  T2: "bg-[var(--color-tier-t2-bg)] text-[var(--color-tier-t2-fg)]",
  T3: "bg-[var(--color-tier-t3-bg)] text-[var(--color-tier-t3-fg)]",
  T4: "bg-[var(--color-tier-t4-bg)] text-[var(--color-tier-t4-fg)]",
};

export default function PortfolioPage() {
  const [data, setData] = useState<Portfolio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(!!localStorage.getItem("sva-onboard-dismissed"));
    (async () => {
      const initData = await initTelegram();
      if (!initData) { setError("Open this from inside Telegram."); return; }
      const res = await fetch("/api/m/portfolio", {
        headers: { Authorization: `tma ${initData}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Failed (${res.status})`);
        return;
      }
      setData(await res.json());
    })().catch((e) => setError(String(e)));
  }, []);

  function dismiss() {
    localStorage.setItem("sva-onboard-dismissed", "1");
    setDismissed(true);
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-center text-sm text-ink-400">{error}</p>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-center text-sm text-ink-300">Loading…</p>
      </main>
    );
  }

  const firstName = data.cm.name.split(" ")[0];
  const visited = data.stores.filter((s) => s.last_visit_date);
  const unvisited = data.stores.filter((s) => !s.last_visit_date);
  const visitedThisMonth = data.stores.filter((s) => s.visits_30d > 0).length;
  const overdueCount = data.stores.filter((s) => {
    const days = daysSince(s.last_visit_date);
    if (days === null) return s.tier === "T1" || s.tier === "T2";
    const threshold = s.tier ? (OVERDUE_DAYS[s.tier] ?? 14) : 14;
    return days > threshold;
  }).length;

  return (
    <main className="min-h-screen pb-12">
      {/* Dark header */}
      <header
        className="px-4 pt-5 pb-5"
        style={{ background: "linear-gradient(160deg, #1C1C22 0%, #26262F 100%)" }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-1">
          Good day
        </p>
        <h1 className="text-[28px] font-extrabold leading-tight text-white">
          {firstName}
        </h1>
        <p className="text-xs text-white/40 mt-0.5">
          {data.stores.length} stores · {data.cm.market}
        </p>

        {/* Stats row — only shown when there's something to show */}
        {(visitedThisMonth > 0 || overdueCount > 0) && (
          <div className="flex gap-2 mt-4">
            <div
              className="flex-1 rounded-xl px-3 py-2.5"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <div className="text-xl font-extrabold text-white leading-none">
                {visitedThisMonth}
              </div>
              <div className="text-[9px] font-semibold uppercase tracking-wide text-white/40 mt-1">
                Visited this month
              </div>
            </div>
            <div
              className="flex-1 rounded-xl px-3 py-2.5"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <div className="text-xl font-extrabold text-white leading-none">
                {data.stores.length}
              </div>
              <div className="text-[9px] font-semibold uppercase tracking-wide text-white/40 mt-1">
                Total stores
              </div>
            </div>
            {overdueCount > 0 && (
              <div
                className="flex-1 rounded-xl px-3 py-2.5"
                style={{ background: "rgba(181,32,32,0.25)" }}
              >
                <div className="text-xl font-extrabold leading-none" style={{ color: "#FF8080" }}>
                  {overdueCount}
                </div>
                <div
                  className="text-[9px] font-semibold uppercase tracking-wide mt-1"
                  style={{ color: "rgba(255,128,128,0.6)" }}
                >
                  Overdue
                </div>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Onboarding banner — one-time */}
      {!dismissed && (
        <div className="mx-3.5 mt-3 rounded-2xl border border-[var(--color-tc-100)] bg-[var(--color-tc-50)] p-3.5">
          <div className="flex gap-3 items-start">
            <span className="text-lg mt-0.5">👋</span>
            <div className="flex-1">
              <p className="text-xs font-bold text-ink-700 mb-0.5">Getting started</p>
              <p className="text-xs text-[var(--color-tc-600)] leading-relaxed">
                Tap any store to see its visit history. Use <strong>/visit</strong> in the bot to log a new visit.
              </p>
              <button
                onClick={dismiss}
                className="mt-2 text-[11px] font-semibold text-[var(--color-tc-600)] bg-[var(--color-tc-100)] rounded-md px-2.5 py-1 cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recently visited */}
      {visited.length > 0 && (
        <section className="mt-4">
          <h2 className="px-4 pb-2 text-[10px] font-bold uppercase tracking-widest text-ink-300">
            Recently visited
          </h2>
          <ul className="space-y-2 px-3.5">
            {visited.map((s) => (
              <StoreCard key={s.id} store={s} />
            ))}
          </ul>
        </section>
      )}

      {/* Never visited */}
      {unvisited.length > 0 && (
        <section className="mt-4">
          <h2 className="px-4 pb-2 text-[10px] font-bold uppercase tracking-widest text-ink-300">
            Never visited
          </h2>
          <ul className="space-y-2 px-3.5">
            {unvisited.map((s) => (
              <StoreCard key={s.id} store={s} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function StoreCard({ store }: { store: PortfolioStore }) {
  const tierStyle = store.tier ? TIER_STYLE[store.tier] : TIER_STYLE.T4;
  const agoClass = visitAgoClass(store.last_visit_date, store.tier);

  return (
    <li>
      <Link
        href={`/m/store/${store.id}`}
        className="flex items-center gap-3 rounded-[18px] border border-ink-100 bg-white p-3.5 shadow-sm active:scale-[0.98] transition-transform"
      >
        {/* Tier badge */}
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-extrabold ${tierStyle}`}
        >
          {store.tier ?? "—"}
        </span>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink-700">{store.name}</p>
          <p className="text-[11px] text-ink-300 mt-0.5">{store.chain}</p>
          <div className="flex items-center justify-between mt-1.5">
            <span className={`text-[11px] ${agoClass}`}>
              {lastVisitLabel(store.last_visit_date)}
            </span>
            {store.visits_30d > 0 && (
              <span className="text-[9px] font-bold bg-[var(--color-tc-50)] text-[var(--color-tc-600)] rounded-full px-2 py-0.5">
                {store.visits_30d} in 30d
              </span>
            )}
          </div>
        </div>

        <span className="text-ink-200 text-lg">›</span>
      </Link>
    </li>
  );
}
