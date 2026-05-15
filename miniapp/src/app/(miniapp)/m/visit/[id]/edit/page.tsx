"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { initTelegram } from "../../../telegram-init";
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
}

type SectionKey = "good_news" | "competitors" | "display_stock" | "follow_up" | "buzz_plan";

const SECTIONS: Array<{
  key: SectionKey;
  label: string;
  icon: string;
  iconBgClass: string;
  titleClass: string;
  placeholder: string;
}> = [
  {
    key: "good_news",
    label: "Good News",
    icon: "🌟",
    iconBgClass: "bg-[var(--color-section-amber-bg)]",
    titleClass: "text-[var(--color-tc-600)]",
    placeholder: "Any wins, positive feedback, or good moments from the visit…",
  },
  {
    key: "competitors",
    label: "Competitors' Insights",
    icon: "🔍",
    iconBgClass: "bg-[var(--color-section-blue-bg)]",
    titleClass: "text-[var(--color-tier-t1-fg)]",
    placeholder: "What are competitors doing? Pricing, promotions, new products…",
  },
  {
    key: "display_stock",
    label: "Display & Stock",
    icon: "📦",
    iconBgClass: "bg-[var(--color-section-green-bg)]",
    titleClass: "text-[var(--color-tier-t2-fg)]",
    placeholder: "Display condition, stock levels, any gaps or issues…",
  },
  {
    key: "follow_up",
    label: "What to Follow Up",
    icon: "✅",
    iconBgClass: "bg-[var(--color-section-pink-bg)]",
    titleClass: "text-[#C0185A]",
    placeholder: "Action items, things to chase up with the store or team…",
  },
  {
    key: "buzz_plan",
    label: "Buzz Plan",
    icon: "⚡",
    iconBgClass: "bg-[var(--color-section-purple-bg)]",
    titleClass: "text-[#5B2DB5]",
    placeholder: "Planned activities, events, or engagement ideas for this store…",
  },
];

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function EditVisitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  useSwipeBack();

  const [visit, setVisit] = useState<FullVisit | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [fields, setFields] = useState<Record<SectionKey, string>>({
    good_news: "",
    competitors: "",
    display_stock: "",
    follow_up: "",
    buzz_plan: "",
  });
  const [initDataStr, setInitDataStr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const initData = await initTelegram();
      if (!initData) { setError("Open this from inside Telegram."); return; }
      setInitDataStr(initData);

      const res = await fetch(`/api/m/visit/${id}`, {
        headers: { Authorization: `tma ${initData}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Failed (${res.status})`);
        return;
      }
      const data = await res.json();
      setVisit(data.visit);
      setPhotoUrls(data.photoUrls ?? []);
      setFields({
        good_news: data.visit.good_news ?? "",
        competitors: data.visit.competitors ?? "",
        display_stock: data.visit.display_stock ?? "",
        follow_up: data.visit.follow_up ?? "",
        buzz_plan: data.visit.buzz_plan ?? "",
      });
    })().catch((e) => setError(String(e)));
  }, [id]);

  async function handleSave() {
    if (!initDataStr || !visit || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/m/visit/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `tma ${initDataStr}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fields),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Save failed");
        return;
      }
      setSaved(true);
      setTimeout(() => router.push(`/m/visit/${id}`), 800);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !initDataStr) return;
    e.target.value = "";

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/m/visit/${id}/photos`, {
        method: "POST",
        headers: { Authorization: `tma ${initDataStr}` },
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Photo upload failed");
        return;
      }
      const { url } = await res.json();
      if (url) setPhotoUrls((prev) => [...prev, url]);
    } catch (e) {
      setError(String(e));
    } finally {
      setUploadingPhoto(false);
    }
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-center text-sm text-ink-400">{error}</p>
      </main>
    );
  }
  if (!visit) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-center text-sm text-ink-300">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28">
      {/* Header */}
      <header className="bg-white border-b border-ink-100 px-4 pt-4 pb-4">
        <button
          onClick={() => router.push(`/m/visit/${id}`)}
          className="text-xs text-ink-300 font-medium flex items-center gap-1 mb-3"
        >
          ‹ Cancel
        </button>
        <h1 className="text-xl font-extrabold text-ink-700 leading-tight">Edit visit</h1>
        <p className="text-xs text-ink-300 mt-0.5">
          {fmtDate(visit.visit_date)} · {visit.store_name}
        </p>
      </header>

      {/* Photos */}
      <div className="px-4 pt-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-ink-300 mb-2">
          Photos
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-0 scrollbar-hide">
          {photoUrls.map((url, i) => (
            <div
              key={url}
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-ink-100"
            >
              <Image
                src={url}
                alt={`Photo ${i + 1}`}
                fill
                className="object-cover"
                sizes="80px"
                unoptimized
              />
            </div>
          ))}

          {/* Add photo button */}
          <button
            type="button"
            disabled={uploadingPhoto}
            onClick={() => fileInputRef.current?.click()}
            className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-ink-200 bg-white text-ink-300 transition-colors active:bg-ink-50 disabled:opacity-50"
          >
            {uploadingPhoto ? (
              <span className="text-xs text-ink-300">…</span>
            ) : (
              <>
                <span className="text-2xl leading-none">+</span>
                <span className="text-[9px] font-semibold uppercase tracking-wide">Photo</span>
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoSelected}
          />
        </div>
      </div>

      {/* Section textareas */}
      <div className="space-y-2 px-3.5 mt-4">
        {SECTIONS.map((s) => (
          <div key={s.key} className="rounded-[18px] border border-ink-100 bg-white p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm ${s.iconBgClass}`}>
                {s.icon}
              </span>
              <span className={`text-[10px] font-extrabold uppercase tracking-wider ${s.titleClass}`}>
                {s.label}
              </span>
            </div>
            <textarea
              value={fields[s.key]}
              onChange={(e) => setFields((prev) => ({ ...prev, [s.key]: e.target.value }))}
              placeholder={s.placeholder}
              rows={3}
              className="w-full resize-none rounded-xl bg-ink-50 px-3 py-2.5 text-[13px] text-ink-600 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-[var(--color-tc-500)] leading-relaxed"
            />
          </div>
        ))}
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-ink-100 px-4 py-3 safe-area-bottom">
        <button
          onClick={handleSave}
          disabled={saving || saved}
          className="w-full rounded-2xl py-3.5 text-sm font-bold transition-all disabled:opacity-60"
          style={{
            background: saved
              ? "var(--color-tier-t2-bg)"
              : "linear-gradient(135deg, var(--color-tc-500) 0%, var(--color-tc-600) 100%)",
            color: saved ? "var(--color-tier-t2-fg)" : "#fff",
          }}
        >
          {saved ? "✓ Saved" : saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </main>
  );
}
