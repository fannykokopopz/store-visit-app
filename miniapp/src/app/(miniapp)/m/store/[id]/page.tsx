"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { initTelegram } from "../../telegram-init";
import { useSwipeBack } from "@/lib/useSwipeBack";

interface VisitSummary {
  id: string;
  visit_date: string;
  good_news: string | null;
  competitors: string | null;
  display_stock: string | null;
  follow_up: string | null;
  buzz_plan: string | null;
  photo_count: number;
}

interface Store {
  id: string;
  name: string;
  chain: string;
  tier: "T1" | "T2" | "T3" | "T4" | null;
  address: string | null;
}

interface StorePayload {
  store: Store;
  visits: VisitSummary[];
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Which of the 5 sections are filled
function filledSections(v: VisitSummary): boolean[] {
  return [
    !!v.good_news,
    !!v.competitors,
    !!v.display_stock,
    !!v.follow_up,
    !!v.buzz_plan,
  ];
}

const TIER_STYLE: Record<string, string> = {
  T1: "bg-[var(--color-tier-t1-bg)] text-[var(--color-tier-t1-fg)]",
  T2: "bg-[var(--color-tier-t2-bg)] text-[var(--color-tier-t2-fg)]",
  T3: "bg-[var(--color-tier-t3-bg)] text-[var(--color-tier-t3-fg)]",
  T4: "bg-[var(--color-tier-t4-bg)] text-[var(--color-tier-t4-fg)]",
};

export default function StorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<StorePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  useSwipeBack();

  useEffect(() => {
    (async () => {
      const initData = await initTelegram();
      if (!initData) { setError("Open this from inside Telegram."); return; }
      const res = await fetch(`/api/m/store/${id}`, {
        headers: { Authorization: `tma ${initData}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Failed (${res.status})`);
        return;
      }
      setData(await res.json());
    })().catch((e) => setError(String(e)));
  }, [id]);

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

  const { store, visits } = data;
  const tierStyle = store.tier ? TIER_STYLE[store.tier] : TIER_STYLE.T4;
  const chainPillStyle = store.tier ? TIER_STYLE[store.tier] : TIER_STYLE.T4;

  return (
    <main className="min-h-screen pb-12">
      {/* Header */}
      <header className="bg-white border-b border-ink-100 px-4 pt-4 pb-4">
        <Link href="/m" className="text-xs text-ink-300 font-medium flex items-center gap-1 mb-3">
          ‹ Portfolio
        </Link>
        <div className="flex items-center gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold ${tierStyle}`}
          >
            {store.tier ?? "—"}
          </span>
          <div>
            <h1 className="text-xl font-extrabold text-ink-700 leading-tight">
              {store.name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${chainPillStyle}`}
              >
                {store.chain}
              </span>
              {visits.length > 0 && (
                <span className="text-[11px] text-ink-300">
                  Last visited {fmtDate(visits[0].visit_date)}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Visit list */}
      {visits.length === 0 ? (
        <div className="mx-4 mt-6 rounded-2xl border border-ink-100 bg-white p-5 text-center">
          <p className="text-2xl mb-2">🗓</p>
          <p className="text-sm font-semibold text-ink-700 mb-1">No visits yet</p>
          <p className="text-xs text-ink-300 leading-relaxed">
            Use <strong>/visit</strong> in the bot to log your first visit here.
          </p>
        </div>
      ) : (
        <section className="mt-4">
          <h2 className="px-4 pb-2 text-[10px] font-bold uppercase tracking-widest text-ink-300">
            {visits.length} {visits.length === 1 ? "visit" : "visits"}
          </h2>
          <ul className="space-y-2 px-3.5">
            {visits.map((v) => (
              <VisitCard key={v.id} visit={v} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function VisitCard({ visit }: { visit: VisitSummary }) {
  const segs = filledSections(visit);
  const filledCount = segs.filter(Boolean).length;

  return (
    <li>
      <Link
        href={`/m/visit/${visit.id}`}
        className="block rounded-[18px] border border-ink-100 bg-white p-3.5 shadow-sm active:scale-[0.98] transition-transform"
      >
        {/* Date row */}
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-sm font-bold text-ink-700">
            {fmtDate(visit.visit_date)}
          </span>
          <span className="text-[11px] text-ink-300">
            {filledCount}/5{visit.photo_count > 0 && <> · 📸 {visit.photo_count}</>}
          </span>
        </div>

        {/* Fill bar — 5 segments */}
        <div className="flex gap-1">
          {segs.map((filled, i) => (
            <div
              key={i}
              className={`h-[3px] flex-1 rounded-full ${
                filled ? "bg-[var(--color-tc-400)]" : "bg-ink-100"
              }`}
            />
          ))}
        </div>
      </Link>
    </li>
  );
}
