"use client";

import { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/Sidebar";

interface VisitRow {
  id: string;
  visit_date: string;
  cm_name: string;
  store_name: string;
  store_chain: string;
  store_tier: "T1" | "T2" | "T3" | "T4" | null;
  good_news: string | null;
  competitors: string | null;
  display_stock: string | null;
  follow_up: string | null;
  buzz_plan: string | null;
  training: string | null;
  photo_count: number;
  sections_filled: number;
  edited_at: string | null;
}

interface CMOption { telegram_id: number; name: string }
interface StoreOption { id: string; name: string; chain: string }
interface User { first_name: string; username?: string }

const TIER_STYLE: Record<string, { bg: string; color: string }> = {
  T1: { bg: "var(--color-tier-t1-bg)", color: "var(--color-tier-t1-fg)" },
  T2: { bg: "var(--color-tier-t2-bg)", color: "var(--color-tier-t2-fg)" },
  T3: { bg: "var(--color-tier-t3-bg)", color: "var(--color-tier-t3-fg)" },
  T4: { bg: "var(--color-tier-t4-bg)", color: "var(--color-tier-t4-fg)" },
};

const SECTIONS = [
  { key: "good_news",    label: "Good News",             icon: "🌟", bg: "var(--color-section-amber-bg)",  border: "var(--color-section-amber-border)",  color: "var(--color-tc-600)" },
  { key: "competitors",  label: "Competitors' Insights", icon: "🔍", bg: "var(--color-section-blue-bg)",   border: "var(--color-section-blue-border)",   color: "var(--color-tier-t1-fg)" },
  { key: "display_stock",label: "Display & Stock",       icon: "📦", bg: "var(--color-section-green-bg)",  border: "var(--color-section-green-border)",  color: "var(--color-tier-t2-fg)" },
  { key: "follow_up",    label: "What to Follow Up",     icon: "✅", bg: "var(--color-section-pink-bg)",   border: "var(--color-section-pink-border)",   color: "#C0185A" },
  { key: "buzz_plan",    label: "Buzz Plan",             icon: "⚡", bg: "var(--color-section-purple-bg)", border: "var(--color-section-purple-border)", color: "#5B2DB5" },
  { key: "training",     label: "Training",              icon: "🎓", bg: "var(--color-section-teal-bg)",   border: "var(--color-section-teal-border)",   color: "var(--color-section-teal-fg)" },
] as const;

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function VisitsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [cms, setCms] = useState<CMOption[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);

  // Filters
  const [filterCM, setFilterCM] = useState("");
  const [filterStore, setFilterStore] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null).then(d => { if (d) setUser(d); });
    fetch("/api/filters").then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setCms(d.cms); setStores(d.stores); }
    });
  }, []);

  const fetchVisits = useCallback(async (newOffset = 0, append = false) => {
    setLoading(true);
    const p = new URLSearchParams();
    if (filterCM) p.set("cm", filterCM);
    if (filterStore) p.set("store", filterStore);
    if (filterFrom) p.set("from", filterFrom);
    if (filterTo) p.set("to", filterTo);
    p.set("offset", String(newOffset));
    const res = await fetch(`/api/visits?${p}`);
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setVisits(append ? (prev) => [...prev, ...data.visits] : data.visits);
    setTotal(data.total);
    setOffset(newOffset);
    setLoading(false);
  }, [filterCM, filterStore, filterFrom, filterTo]);

  useEffect(() => { fetchVisits(0); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function applyFilters() { fetchVisits(0); setExpanded(null); }
  function clearFilters() {
    setFilterCM(""); setFilterStore(""); setFilterFrom(""); setFilterTo("");
    setTimeout(() => fetchVisits(0), 0);
    setExpanded(null);
  }

  if (!user) return null;

  const hasMore = offset + 25 < total;

  return (
    <div className="layout">
      <Sidebar user={user} />
      <main className="main">
        <header
          className="sticky top-0 z-10 px-8 py-5 border-b"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-extrabold" style={{ color: "var(--color-ink-900)" }}>
                Visits
              </h1>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-ink-300)" }}>
                {total} visit{total !== 1 ? "s" : ""} · {loading ? "loading…" : "up to date"}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2 mt-4 flex-wrap">
            <select
              value={filterCM}
              onChange={e => setFilterCM(e.target.value)}
              className="rounded-xl border px-3 py-1.5 text-[12px] font-medium"
              style={{ borderColor: "var(--color-border)", color: "var(--color-ink-700)", background: "var(--color-surface)" }}
            >
              <option value="">All CMs</option>
              {cms.map(c => <option key={c.telegram_id} value={c.telegram_id}>{c.name}</option>)}
            </select>

            <select
              value={filterStore}
              onChange={e => setFilterStore(e.target.value)}
              className="rounded-xl border px-3 py-1.5 text-[12px] font-medium"
              style={{ borderColor: "var(--color-border)", color: "var(--color-ink-700)", background: "var(--color-surface)" }}
            >
              <option value="">All stores</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <input
              type="date"
              value={filterFrom}
              onChange={e => setFilterFrom(e.target.value)}
              className="rounded-xl border px-3 py-1.5 text-[12px]"
              style={{ borderColor: "var(--color-border)", color: "var(--color-ink-700)", background: "var(--color-surface)" }}
            />
            <input
              type="date"
              value={filterTo}
              onChange={e => setFilterTo(e.target.value)}
              className="rounded-xl border px-3 py-1.5 text-[12px]"
              style={{ borderColor: "var(--color-border)", color: "var(--color-ink-700)", background: "var(--color-surface)" }}
            />

            <button
              onClick={applyFilters}
              className="rounded-xl px-4 py-1.5 text-[12px] font-bold text-white"
              style={{ background: "var(--color-tc-500)" }}
            >
              Filter
            </button>
            {(filterCM || filterStore || filterFrom || filterTo) && (
              <button
                onClick={clearFilters}
                className="rounded-xl px-3 py-1.5 text-[12px] font-medium"
                style={{ color: "var(--color-ink-300)", background: "var(--color-ink-50)" }}
              >
                Clear
              </button>
            )}
          </div>
        </header>

        <div className="px-8 py-4">
          {/* Table */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ background: "var(--color-ink-50)", borderBottom: "1px solid var(--color-border)" }}>
                  <th className="px-4 py-3 text-left font-semibold text-[11px] uppercase tracking-wide" style={{ color: "var(--color-ink-300)" }}>Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-[11px] uppercase tracking-wide" style={{ color: "var(--color-ink-300)" }}>Store</th>
                  <th className="px-4 py-3 text-left font-semibold text-[11px] uppercase tracking-wide" style={{ color: "var(--color-ink-300)" }}>CM</th>
                  <th className="px-4 py-3 text-left font-semibold text-[11px] uppercase tracking-wide" style={{ color: "var(--color-ink-300)" }}>Sections</th>
                  <th className="px-4 py-3 text-left font-semibold text-[11px] uppercase tracking-wide" style={{ color: "var(--color-ink-300)" }}>Photos</th>
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody>
                {visits.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-[13px]" style={{ color: "var(--color-ink-300)" }}>
                      No visits found.
                    </td>
                  </tr>
                )}
                {visits.map((v) => {
                  const tier = v.store_tier;
                  const ts = tier ? TIER_STYLE[tier] : TIER_STYLE.T4;
                  const isExpanded = expanded === v.id;
                  const filledSections = SECTIONS.filter(s => v[s.key]);

                  return (
                    <>
                      <tr
                        key={v.id}
                        onClick={() => setExpanded(isExpanded ? null : v.id)}
                        className="cursor-pointer transition-colors"
                        style={{
                          borderBottom: isExpanded ? "none" : "1px solid var(--color-border)",
                          background: isExpanded ? "var(--color-ink-50)" : "var(--color-surface)",
                        }}
                        onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.background = "var(--color-ink-50)"; }}
                        onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.background = "var(--color-surface)"; }}
                      >
                        <td className="px-4 py-3.5 font-medium whitespace-nowrap" style={{ color: "var(--color-ink-700)" }}>
                          {fmtDate(v.visit_date)}
                          {v.edited_at && (
                            <span className="ml-1.5 text-[10px]" style={{ color: "var(--color-ink-300)" }}>edited</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            {tier && (
                              <span
                                className="tier-badge shrink-0"
                                style={{ background: ts.bg, color: ts.color }}
                              >
                                {tier}
                              </span>
                            )}
                            <span className="font-semibold truncate max-w-[180px]" style={{ color: "var(--color-ink-900)" }}>
                              {v.store_name}
                            </span>
                          </div>
                          <p className="text-[11px] mt-0.5 pl-0" style={{ color: "var(--color-ink-300)" }}>{v.store_chain}</p>
                        </td>
                        <td className="px-4 py-3.5" style={{ color: "var(--color-ink-700)" }}>{v.cm_name}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex gap-0.5">
                            {Array.from({ length: 6 }, (_, i) => (
                              <div
                                key={i}
                                className="h-2.5 w-2.5 rounded-sm"
                                style={{
                                  background: i < v.sections_filled
                                    ? "var(--color-tc-500)"
                                    : "var(--color-ink-100)",
                                }}
                              />
                            ))}
                          </div>
                          <p className="text-[10px] mt-1" style={{ color: "var(--color-ink-300)" }}>
                            {v.sections_filled}/6
                          </p>
                        </td>
                        <td className="px-4 py-3.5" style={{ color: "var(--color-ink-500)" }}>
                          {v.photo_count > 0 ? `📸 ${v.photo_count}` : "—"}
                        </td>
                        <td className="px-4 py-3.5 text-right" style={{ color: "var(--color-ink-300)" }}>
                          {isExpanded ? "▲" : "▼"}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${v.id}-detail`}>
                          <td
                            colSpan={6}
                            className="px-4 pb-4"
                            style={{ background: "var(--color-ink-50)", borderBottom: "1px solid var(--color-border)" }}
                          >
                            {filledSections.length === 0 ? (
                              <p className="text-[12px] py-2" style={{ color: "var(--color-ink-300)" }}>
                                No notes were added for this visit.
                              </p>
                            ) : (
                              <div className="grid grid-cols-2 gap-2 pt-2">
                                {filledSections.map(s => (
                                  <div
                                    key={s.key}
                                    className="rounded-xl p-3.5"
                                    style={{ background: s.bg, border: `1px solid ${s.border}` }}
                                  >
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <span className="text-sm">{s.icon}</span>
                                      <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: s.color }}>
                                        {s.label}
                                      </span>
                                    </div>
                                    <p className="text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--color-ink-700)" }}>
                                      {v[s.key]}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center mt-4">
              <button
                onClick={() => fetchVisits(offset + 25, true)}
                disabled={loading}
                className="rounded-xl px-6 py-2.5 text-[13px] font-semibold transition-colors disabled:opacity-50"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-ink-500)" }}
              >
                {loading ? "Loading…" : `Load more (${total - offset - 25} remaining)`}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
