"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { initTelegram } from "../../telegram-init";
import { useSwipeBack } from "@/lib/useSwipeBack";

interface FullVisit {
  id: string;
  store_id: string;
  store_name: string;
  visit_date: string;
  good_news: string | null;
  competitors: string | null;
  display_stock: string | null;
  follow_up: string | null;
  buzz_plan: string | null;
  photo_count: number;
  is_locked: boolean;
  edited_at: string | null;
}

interface VisitPayload {
  visit: FullVisit;
  photoUrls: string[];
}

type SectionKey = "good_news" | "competitors" | "display_stock" | "follow_up" | "buzz_plan";

const SECTIONS: Array<{
  key: SectionKey;
  label: string;
  icon: string;
  colorClass: string;
  titleClass: string;
}> = [
  {
    key: "good_news",
    label: "Good News",
    icon: "🌟",
    colorClass: "bg-[var(--color-section-amber-bg)] border-[var(--color-section-amber-border)]",
    titleClass: "text-[var(--color-tc-600)]",
  },
  {
    key: "competitors",
    label: "Competitors' Insights",
    icon: "🔍",
    colorClass: "bg-[var(--color-section-blue-bg)] border-[var(--color-section-blue-border)]",
    titleClass: "text-[var(--color-tier-t1-fg)]",
  },
  {
    key: "display_stock",
    label: "Display & Stock",
    icon: "📦",
    colorClass: "bg-[var(--color-section-green-bg)] border-[var(--color-section-green-border)]",
    titleClass: "text-[var(--color-tier-t2-fg)]",
  },
  {
    key: "follow_up",
    label: "What to Follow Up",
    icon: "✅",
    colorClass: "bg-[var(--color-section-pink-bg)] border-[var(--color-section-pink-border)]",
    titleClass: "text-[#C0185A]",
  },
  {
    key: "buzz_plan",
    label: "Buzz Plan",
    icon: "⚡",
    colorClass: "bg-[var(--color-section-purple-bg)] border-[var(--color-section-purple-border)]",
    titleClass: "text-[#5B2DB5]",
  },
];

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function VisitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<VisitPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  useSwipeBack();

  useEffect(() => {
    (async () => {
      const initData = await initTelegram();
      if (!initData) { setError("Open this from inside Telegram."); return; }
      const res = await fetch(`/api/m/visit/${id}`, {
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

  const { visit, photoUrls } = data;
  const filled = SECTIONS.filter((s) => visit[s.key]);

  return (
    <main className="min-h-screen pb-12">
      {/* Header */}
      <header className="bg-white border-b border-ink-100 px-4 pt-4 pb-4">
        <Link
          href={`/m/store/${visit.store_id}`}
          className="text-xs text-ink-300 font-medium flex items-center gap-1 mb-3"
        >
          ‹ {visit.store_name}
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold text-ink-700 leading-tight">
              {fmtDate(visit.visit_date)}
            </h1>
            <p className="text-xs text-ink-300 mt-0.5">
              {visit.store_name}
              {visit.edited_at && <> · edited</>}
              {" · "}{filled.length}/5 sections
            </p>
          </div>
          <Link
            href={`/m/visit/${visit.id}/edit`}
            className="shrink-0 rounded-xl bg-ink-50 px-3 py-1.5 text-[11px] font-bold text-ink-400 active:bg-ink-100"
          >
            Edit
          </Link>
        </div>
      </header>

      {/* Photos */}
      {photoUrls.length > 0 && (
        <div className="-mx-0 flex gap-2 overflow-x-auto px-4 py-4 scrollbar-hide">
          {photoUrls.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setLightboxIndex(i)}
              className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-ink-100"
            >
              <Image
                src={url}
                alt={`Photo ${i + 1}`}
                fill
                className="object-cover"
                sizes="96px"
                unoptimized
              />
            </button>
          ))}
        </div>
      )}

      {/* Sections */}
      <div className={`space-y-2 px-3.5 ${photoUrls.length === 0 ? "mt-4" : ""}`}>
        {filled.length === 0 ? (
          <div className="rounded-2xl border border-ink-100 bg-white p-5 text-center">
            <p className="text-sm text-ink-300">No notes were added for this visit.</p>
          </div>
        ) : (
          filled.map((s) => (
            <div
              key={s.key}
              className={`rounded-[18px] border p-4 ${s.colorClass}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/60 text-sm">
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
          ))
        )}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxIndex(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
        >
          <Image
            src={photoUrls[lightboxIndex]}
            alt={`Photo ${lightboxIndex + 1}`}
            width={1200}
            height={1200}
            className="max-h-full max-w-full object-contain"
            unoptimized
          />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
            className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1 text-sm text-white"
          >
            Close
          </button>
        </div>
      )}
    </main>
  );
}
