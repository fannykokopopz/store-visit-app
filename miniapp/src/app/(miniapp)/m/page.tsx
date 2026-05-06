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

function daysAgo(dateStr: string | null): string {
  if (!dateStr) return "Never visited";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const then = new Date(dateStr);
  then.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - then.getTime()) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "1 day ago";
  if (diff < 30) return `${diff} days ago`;
  if (diff < 60) return "Over a month ago";
  return "Over 2 months ago";
}

const TIER_COLOR: Record<string, string> = {
  T1: "bg-[var(--color-tier-t1)]",
  T2: "bg-[var(--color-tier-t2)]",
  T3: "bg-[var(--color-tier-t3)]",
  T4: "bg-[var(--color-tier-t4)]",
};

export default function PortfolioPage() {
  const [data, setData] = useState<Portfolio | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const initData = await initTelegram();
      if (!initData) {
        setError("Open this from inside Telegram.");
        return;
      }
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

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-center text-base text-ink-400">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-center text-base text-ink-400">Loading…</p>
      </main>
    );
  }

  const visited = data.stores.filter((s) => s.last_visit_date);
  const unvisited = data.stores.filter((s) => !s.last_visit_date);

  return (
    <main className="min-h-screen p-4 pb-12">
      <header className="mb-6 mt-2">
        <h1 className="text-2xl font-bold">Hi {data.cm.name.split(" ")[0]}</h1>
        <p className="text-sm text-ink-400">
          {data.stores.length} stores · {data.cm.market}
        </p>
      </header>

      {visited.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
            Recently visited
          </h2>
          <ul className="space-y-2">
            {visited.map((s) => (
              <StoreCard key={s.id} store={s} />
            ))}
          </ul>
        </section>
      )}

      {unvisited.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
            Not yet visited
          </h2>
          <ul className="space-y-2">
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
  const tierClass = store.tier ? TIER_COLOR[store.tier] : "bg-ink-300";
  return (
    <li>
      <Link
        href={`/m/store/${store.id}`}
        className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-3 shadow-sm active:bg-ink-50"
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${tierClass}`}
        >
          {store.tier ?? "—"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-ink-700">
            {store.name}
          </p>
          <p className="text-xs text-ink-400">
            {daysAgo(store.last_visit_date)}
            {store.visits_30d > 0 && (
              <>
                {" "}
                · {store.visits_30d} in 30d
              </>
            )}
          </p>
        </div>
        <span className="text-ink-300">›</span>
      </Link>
    </li>
  );
}
