"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { initTelegram } from "../../telegram-init";

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

function filledCount(v: VisitSummary): number {
  let n = 0;
  if (v.good_news) n++;
  if (v.competitors) n++;
  if (v.display_stock) n++;
  if (v.follow_up) n++;
  if (v.buzz_plan) n++;
  return n;
}

function preview(v: VisitSummary): string {
  const text =
    v.good_news ??
    v.competitors ??
    v.display_stock ??
    v.follow_up ??
    v.buzz_plan ??
    "";
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 90 ? oneLine.slice(0, 87) + "…" : oneLine;
}

export default function StorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<StorePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const initData = await initTelegram();
      if (!initData) {
        setError("Open this from inside Telegram.");
        return;
      }
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

  return (
    <main className="min-h-screen p-4 pb-12">
      <Link href="/m" className="mb-4 inline-block text-sm text-ink-400">
        ← Portfolio
      </Link>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">{data.store.name}</h1>
        <p className="text-sm text-ink-400">
          {data.store.chain}
          {data.store.tier && <> · {data.store.tier}</>}
        </p>
      </header>

      {data.visits.length === 0 ? (
        <p className="rounded-2xl border border-ink-100 bg-white p-4 text-sm text-ink-400">
          No visits logged yet.
        </p>
      ) : (
        <>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
            {data.visits.length} visit{data.visits.length === 1 ? "" : "s"}
          </h2>
          <ul className="space-y-2">
            {data.visits.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/m/visit/${v.id}`}
                  className="block rounded-2xl border border-ink-100 bg-white p-3 shadow-sm active:bg-ink-50"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-semibold text-ink-700">
                      {fmtDate(v.visit_date)}
                    </span>
                    <span className="text-xs text-ink-400">
                      {filledCount(v)}/5
                      {v.photo_count > 0 && <> · 📸 {v.photo_count}</>}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm text-ink-500">
                    {preview(v) || "(empty)"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
