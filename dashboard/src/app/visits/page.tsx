"use client";

import { useEffect, useState, useCallback } from "react";
import NavBar from "@/components/NavBar";

type Market = "ALL" | "SG" | "MY" | "TH" | "HK";

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
interface User { first_name: string; username?: string }

const MARKET_OPTIONS: { value: Market; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "SG",  label: "🇸🇬 SG" },
  { value: "MY",  label: "🇲🇾 MY" },
  { value: "TH",  label: "🇹🇭 TH" },
  { value: "HK",  label: "🇭🇰 HK" },
];

const TIER_STYLE: Record<string, { bg: string; color: string }> = {
  T1: { bg: "var(--color-tier-t1-bg)", color: "var(--color-tier-t1-fg)" },
  T2: { bg: "var(--color-tier-t2-bg)", color: "var(--color-tier-t2-fg)" },
  T3: { bg: "var(--color-tier-t3-bg)", color: "var(--color-tier-t3-fg)" },
  T4: { bg: "var(--color-tier-t4-bg)", color: "var(--color-tier-t4-fg)" },
};

const SECTIONS = [
  { key: "good_news",     label: "Good News",             icon: "🌟", bg: "var(--color-section-amber-bg)",  border: "var(--color-section-amber-border)",  color: "var(--color-tc-600)" },
  { key: "competitors",   label: "Competitors' Insights", icon: "🔍", bg: "var(--color-section-blue-bg)",   border: "var(--color-section-blue-border)",   color: "var(--color-tier-t1-fg)" },
  { key: "display_stock", label: "Display & Stock",       icon: "📦", bg: "var(--color-section-green-bg)",  border: "var(--color-section-green-border)",  color: "var(--color-tier-t2-fg)" },
  { key: "follow_up",     label: "What to Follow Up",     icon: "✅", bg: "var(--color-section-pink-bg)",   border: "var(--color-section-pink-border)",   color: "#C0185A" },
  { key: "buzz_plan",     label: "Buzz Plan",             icon: "⚡", bg: "var(--color-section-purple-bg)", border: "var(--color-section-purple-border)", color: "#5B2DB5" },
  { key: "training",      label: "Training",              icon: "🎓", bg: "var(--color-section-teal-bg)",   border: "var(--color-section-teal-border)",   color: "var(--color-section-teal-fg)" },
] as const;

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addWeeks(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}

function toISO(d: Date): string { return d.toISOString().slice(0, 10); }

function weekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmtDay = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const year = monday.getFullYear();
  return `${fmtDay(monday)} – ${fmtDay(sunday)} ${year}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default function VisitsPage() {
  const [user,     setUser]     = useState<User | null>(null);
  const [visits,   setVisits]   = useState<VisitRow[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [cms,      setCms]      = useState<CMOption[]>([]);
  const [market,   setMarket]   = useState<Market>("ALL");
  const [filterCM, setFilterCM] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);

  const thisMonday = getMonday(new Date());
  const currentMonday = addWeeks(thisMonday, weekOffset);
  const currentSunday = new Date(currentMonday);
  currentSunday.setDate(currentMonday.getDate() + 6);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null).then(d => { if (d) setUser(d); });
    fetch("/api/filters").then(r => r.ok ? r.json() : null).then(d => {
      if (d) setCms(d.cms);
    });
  }, []);

  const fetchVisits = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    p.set("from", toISO(currentMonday));
    p.set("to", toISO(currentSunday));
    if (market !== "ALL") p.set("market", market);
    if (filterCM) p.set("cm", filterCM);
    const res = await fetch(`/api/visits?${p}`);
    if (res.ok) {
      const data = await res.json();
      setVisits(data.visits);
      setTotal(data.total);
    }
    setLoading(false);
    setExpanded(null);
  }, [market, filterCM, weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchVisits(); }, [fetchVisits]);

  if (!user) return null;

  const isCurrentWeek = weekOffset === 0;
  const isFutureWeek  = weekOffset > 0;

  return (
    <div>
      <NavBar user={user} />
      <div className="page-content">

        {/* Page header */}
        <div style={{ marginBottom: 24 }}>
          <h1 className="section-title" style={{ fontSize: 20, marginBottom: 4 }}>Store Updates</h1>
          <p style={{ fontSize: 13, color: "var(--color-ink-300)" }}>
            {loading ? "Loading…" : `${total} visit${total !== 1 ? "s" : ""} this week`}
          </p>
        </div>

        {/* Controls row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>

          {/* Market chips */}
          <div className="market-chips">
            {MARKET_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                className={`mchip${market === value ? " active" : ""}`}
                onClick={() => setMarket(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {/* Week navigation */}
          <div className="week-nav">
            <button
              className="week-btn"
              onClick={() => setWeekOffset(w => w - 1)}
            >
              ‹
            </button>
            <span className="week-label">
              {isCurrentWeek ? "This week" : weekLabel(currentMonday)}
            </span>
            <button
              className="week-btn"
              disabled={isFutureWeek}
              onClick={() => setWeekOffset(w => w + 1)}
            >
              ›
            </button>
          </div>

          {/* CM filter */}
          {cms.length > 0 && (
            <select
              value={filterCM}
              onChange={e => setFilterCM(e.target.value)}
              className="filter-select"
            >
              <option value="">All CMs</option>
              {cms.map(c => <option key={c.telegram_id} value={c.telegram_id}>{c.name}</option>)}
            </select>
          )}
        </div>

        {/* Visit feed */}
        {loading ? (
          <div className="empty-state">
            <p style={{ color: "var(--color-ink-300)", fontSize: 13 }}>Loading…</p>
          </div>
        ) : visits.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-icon">📋</p>
            <p>No visits logged for this week{market !== "ALL" ? ` in ${market}` : ""}.</p>
          </div>
        ) : (
          <div>
            {visits.map(v => {
              const tier = v.store_tier;
              const ts = tier ? TIER_STYLE[tier] : null;
              const isExpanded = expanded === v.id;
              const filledSections = SECTIONS.filter(s => v[s.key]);

              return (
                <div key={v.id} className="visit-card">
                  {/* Card header */}
                  <div
                    className="visit-card-header"
                    onClick={() => setExpanded(isExpanded ? null : v.id)}
                    style={{ background: isExpanded ? "var(--color-ink-50)" : undefined }}
                  >
                    {ts && (
                      <span className="tier-badge" style={{ background: ts.bg, color: ts.color }}>
                        {tier}
                      </span>
                    )}
                    <div className="visit-card-store">
                      <p className="visit-store-name">{v.store_name}</p>
                      <div className="visit-meta-row">
                        <span className="visit-meta-item">{v.cm_name}</span>
                        <span className="visit-meta-item">·</span>
                        <span className="visit-meta-item">{fmtDate(v.visit_date)}</span>
                        <span className="visit-meta-item">·</span>
                        {/* Section dots */}
                        <span className="visit-sections">
                          {Array.from({ length: 6 }, (_, i) => (
                            <span
                              key={i}
                              className="visit-section-dot"
                              style={{
                                background: i < v.sections_filled
                                  ? "var(--color-tc-500)"
                                  : "var(--color-ink-100)",
                              }}
                            />
                          ))}
                          <span className="visit-meta-item" style={{ marginLeft: 4 }}>
                            {v.sections_filled}/6
                          </span>
                        </span>
                        {v.photo_count > 0 && (
                          <>
                            <span className="visit-meta-item">·</span>
                            <span className="visit-meta-item">📸 {v.photo_count}</span>
                          </>
                        )}
                        {v.edited_at && (
                          <>
                            <span className="visit-meta-item">·</span>
                            <span className="visit-meta-item" style={{ color: "var(--color-ink-300)" }}>edited</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="visit-chevron">{isExpanded ? "▲" : "▼"}</span>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="visit-detail">
                      {filledSections.length === 0 ? (
                        <p style={{ fontSize: 13, color: "var(--color-ink-300)", paddingTop: 14 }}>
                          No notes were added for this visit.
                        </p>
                      ) : (
                        <div className="visit-sections-grid">
                          {filledSections.map(s => (
                            <div
                              key={s.key}
                              className="visit-section-card"
                              style={{ background: s.bg, border: `1px solid ${s.border}` }}
                            >
                              <div className="visit-section-label" style={{ color: s.color }}>
                                <span>{s.icon}</span>
                                <span>{s.label}</span>
                              </div>
                              <p className="visit-section-text">{v[s.key]}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
