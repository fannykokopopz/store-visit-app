"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { initTelegram } from "../../telegram-init";

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

const SECTIONS: Array<{ key: keyof FullVisit; label: string; emoji: string }> = [
  { key: "good_news", label: "Good News", emoji: "1️⃣" },
  { key: "competitors", label: "Competitors' Insights", emoji: "2️⃣" },
  { key: "display_stock", label: "Display & Stock", emoji: "3️⃣" },
  { key: "follow_up", label: "What to Follow Up", emoji: "4️⃣" },
  { key: "buzz_plan", label: "Buzz Plan", emoji: "5️⃣" },
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

  useEffect(() => {
    (async () => {
      const initData = await initTelegram();
      if (!initData) {
        setError("Open this from inside Telegram.");
        return;
      }
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

  const { visit, photoUrls } = data;
  const filled = SECTIONS.filter((s) => visit[s.key]);

  return (
    <main className="min-h-screen p-4 pb-12">
      <Link
        href={`/m/store/${visit.store_id}`}
        className="mb-4 inline-block text-sm text-ink-400"
      >
        ← {visit.store_name}
      </Link>
      <header className="mb-4">
        <h1 className="text-xl font-bold">{visit.store_name}</h1>
        <p className="text-sm text-ink-400">
          {fmtDate(visit.visit_date)}
          {visit.edited_at && <> · edited</>}
        </p>
      </header>

      {photoUrls.length > 0 && (
        <section className="mb-6">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
            {photoUrls.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => setLightboxIndex(i)}
                className="relative h-32 w-32 shrink-0 overflow-hidden rounded-xl bg-ink-100"
              >
                <Image
                  src={url}
                  alt={`Visit photo ${i + 1}`}
                  fill
                  className="object-cover"
                  sizes="128px"
                  unoptimized
                />
              </button>
            ))}
          </div>
        </section>
      )}

      {filled.length === 0 ? (
        <p className="rounded-2xl border border-ink-100 bg-white p-4 text-sm text-ink-400">
          No notes for this visit.
        </p>
      ) : (
        <ul className="space-y-3">
          {filled.map((s) => (
            <li
              key={s.key}
              className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm"
            >
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-tc-500">
                {s.emoji} {s.label}
              </h3>
              <p className="whitespace-pre-wrap text-sm text-ink-700">
                {visit[s.key] as string}
              </p>
            </li>
          ))}
        </ul>
      )}

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
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex(null);
            }}
            className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1 text-sm text-white"
          >
            Close
          </button>
        </div>
      )}
    </main>
  );
}
