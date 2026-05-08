"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
  cm_name?: string | null;
  photo_count: number;
  thumb_urls: string[];
  photo_urls?: string[];
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

const TIER_STYLE: Record<string, string> = {
  T1: "bg-[var(--color-tier-t1-bg)] text-[var(--color-tier-t1-fg)]",
  T2: "bg-[var(--color-tier-t2-bg)] text-[var(--color-tier-t2-fg)]",
  T3: "bg-[var(--color-tier-t3-bg)] text-[var(--color-tier-t3-fg)]",
  T4: "bg-[var(--color-tier-t4-bg)] text-[var(--color-tier-t4-fg)]",
};

export default function StorePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ all?: string }>;
}) {
  const { id } = use(params);
  const sp = use(searchParams);
  const allCMs = sp.all === "true";

  const [data, setData] = useState<StorePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [galleryMode, setGalleryMode] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  useSwipeBack();

  useEffect(() => {
    (async () => {
      const initData = await initTelegram();
      if (!initData) { setError("Open this from inside Telegram."); return; }
      const url = `/api/m/store/${id}${allCMs ? "?all=true" : ""}`;
      const res = await fetch(url, { headers: { Authorization: `tma ${initData}` } });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Failed (${res.status})`);
        return;
      }
      setData(await res.json());
    })().catch((e) => setError(String(e)));
  }, [id, allCMs]);

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

  // Flatten all photos across all visits for gallery mode
  const allPhotos = visits.flatMap((v) =>
    (v.photo_urls ?? v.thumb_urls).map((url) => ({ url, visitId: v.id, visitDate: v.visit_date }))
  );

  const hasPhotos = allPhotos.length > 0;

  return (
    <>
      <main className="min-h-screen pb-12">
        {/* Header */}
        <header className="bg-white border-b border-ink-100 px-4 pt-4 pb-4">
          <Link
            href={allCMs ? "/m?tab=all" : "/m"}
            className="text-xs text-ink-300 font-medium flex items-center gap-1 mb-3"
          >
            ‹ {allCMs ? "All Stores" : "Portfolio"}
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
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${chainPillStyle}`}>
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

        {/* Visit list / gallery */}
        {visits.length === 0 ? (
          <div className="mx-4 mt-6 rounded-2xl border border-ink-100 bg-white p-5 text-center">
            <p className="text-2xl mb-2">🗓</p>
            <p className="text-sm font-semibold text-ink-700 mb-1">No visits yet</p>
            <p className="text-xs text-ink-300 leading-relaxed">
              Use <strong>/visit</strong> in the bot to log the first visit here.
            </p>
          </div>
        ) : (
          <section className="mt-4">
            <div className="px-4 pb-2 flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-ink-300">
                {visits.length} {visits.length === 1 ? "visit" : "visits"}
              </h2>
              {hasPhotos && (
                <button
                  onClick={() => setGalleryMode((m) => !m)}
                  className="text-[11px] font-semibold text-ink-400 bg-ink-100 rounded-lg px-2.5 py-1"
                >
                  {galleryMode ? "≡ List" : "⊞ Gallery"}
                </button>
              )}
            </div>

            {galleryMode ? (
              /* Gallery grid */
              <div className="grid grid-cols-3 gap-0.5 px-3.5">
                {allPhotos.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setLightbox(p.url)}
                    className="relative aspect-square overflow-hidden rounded-sm bg-ink-100"
                  >
                    <Image src={p.url} alt="" fill className="object-cover" sizes="33vw" unoptimized />
                  </button>
                ))}
              </div>
            ) : (
              /* List view */
              <ul className="space-y-2 px-3.5">
                {visits.map((v) => (
                  <VisitCard key={v.id} visit={v} showCM={allCMs} />
                ))}
              </ul>
            )}
          </section>
        )}
      </main>

      {/* Photo lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 text-sm font-semibold z-10"
            onClick={() => setLightbox(null)}
          >
            Close
          </button>
          <div className="relative w-full max-w-lg aspect-square mx-4">
            <Image src={lightbox} alt="" fill className="object-contain" sizes="100vw" unoptimized />
          </div>
        </div>
      )}
    </>
  );
}

function VisitCard({ visit, showCM }: { visit: VisitSummary; showCM?: boolean }) {
  return (
    <li>
      <Link
        href={`/m/visit/${visit.id}`}
        className="block rounded-[18px] border border-ink-100 bg-white p-3.5 shadow-sm active:scale-[0.98] transition-transform"
      >
        <div className={`flex items-center justify-between ${visit.thumb_urls.length > 0 ? "mb-2.5" : ""}`}>
          <div>
            <span className="text-sm font-bold text-ink-700">{fmtDate(visit.visit_date)}</span>
            {showCM && visit.cm_name && (
              <span className="ml-2 text-[11px] text-ink-300">{visit.cm_name}</span>
            )}
          </div>
          {visit.photo_count > 0 && (
            <span className="text-[11px] text-ink-300">📸 {visit.photo_count}</span>
          )}
        </div>
        {visit.thumb_urls.length > 0 && (
          <div className="flex gap-2">
            {visit.thumb_urls.map((url, i) => (
              <div key={i} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-ink-100">
                <Image src={url} alt="" fill className="object-cover" sizes="64px" unoptimized />
              </div>
            ))}
          </div>
        )}
      </Link>
    </li>
  );
}
