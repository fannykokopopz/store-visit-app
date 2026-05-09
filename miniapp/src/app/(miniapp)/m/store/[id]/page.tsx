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
  training: string | null;
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

type SectionKey = "good_news" | "competitors" | "display_stock" | "follow_up" | "buzz_plan" | "training";

const SECTIONS: Array<{
  key: SectionKey;
  label: string;
  icon: string;
  colorClass: string;
  titleClass: string;
}> = [
  { key: "good_news",     label: "Good News",             icon: "🌟", colorClass: "bg-[var(--color-section-amber-bg)] border-[var(--color-section-amber-border)]",   titleClass: "text-[var(--color-tc-600)]" },
  { key: "competitors",   label: "Competitors' Insights", icon: "🔍", colorClass: "bg-[var(--color-section-blue-bg)] border-[var(--color-section-blue-border)]",    titleClass: "text-[var(--color-tier-t1-fg)]" },
  { key: "display_stock", label: "Display & Stock",       icon: "📦", colorClass: "bg-[var(--color-section-green-bg)] border-[var(--color-section-green-border)]",  titleClass: "text-[var(--color-tier-t2-fg)]" },
  { key: "follow_up",     label: "What to Follow Up",     icon: "✅", colorClass: "bg-[var(--color-section-pink-bg)] border-[var(--color-section-pink-border)]",   titleClass: "text-[#C0185A]" },
  { key: "buzz_plan",     label: "Buzz Plan",             icon: "⚡", colorClass: "bg-[var(--color-section-purple-bg)] border-[var(--color-section-purple-border)]", titleClass: "text-[#5B2DB5]" },
  { key: "training",      label: "Training",              icon: "🎓", colorClass: "bg-[var(--color-section-teal-bg)] border-[var(--color-section-teal-border)]",    titleClass: "text-[var(--color-section-teal-fg)]" },
];

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
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

  const [data,       setData]       = useState<StorePayload | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [galleryMode, setGalleryMode] = useState(false);
  const [lightbox,   setLightbox]   = useState<string | null>(null);
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
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold ${tierStyle}`}>
              {store.tier ?? "—"}
            </span>
            <div>
              <h1 className="text-xl font-extrabold text-ink-700 leading-tight">{store.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tierStyle}`}>{store.chain}</span>
                {visits.length > 0 && (
                  <span className="text-[11px] text-ink-300">Last visited {fmtDate(visits[0].visit_date)}</span>
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
              <ul className="space-y-2 px-3.5">
                {visits.map((v) => (
                  <VisitCard key={v.id} visit={v} showCM={allCMs} onPhotoClick={setLightbox} />
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

function VisitCard({
  visit,
  showCM,
  onPhotoClick,
}: {
  visit: VisitSummary;
  showCM?: boolean;
  onPhotoClick: (url: string) => void;
}) {
  const photos = visit.photo_urls ?? visit.thumb_urls;
  const filledSections = SECTIONS.filter((s) => visit[s.key]);

  return (
    <li className="rounded-[18px] border border-ink-100 bg-white p-3.5 shadow-sm">
      {/* Date + CM + photo count row */}
      <div className="flex items-center justify-between mb-3">
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

      {/* Photos — horizontal scroll, bigger thumbnails */}
      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-3 scrollbar-hide">
          {photos.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onPhotoClick(url)}
              className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-ink-100"
            >
              <Image src={url} alt={`Photo ${i + 1}`} fill className="object-cover" sizes="112px" unoptimized />
            </button>
          ))}
        </div>
      )}

      {/* Sections */}
      {filledSections.length > 0 && (
        <div className="space-y-2">
          {filledSections.map((s) => (
            <div key={s.key} className={`rounded-[14px] border p-3 ${s.colorClass}`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/60 text-xs">
                  {s.icon}
                </span>
                <span className={`text-[10px] font-extrabold uppercase tracking-wider ${s.titleClass}`}>
                  {s.label}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-500">
                {visit[s.key] as string}
              </p>
            </div>
          ))}
        </div>
      )}

      {filledSections.length === 0 && photos.length === 0 && (
        <p className="text-xs text-ink-300">No notes for this visit.</p>
      )}
    </li>
  );
}
