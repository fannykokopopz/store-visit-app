"use client";

import { useEffect, useState } from "react";
import NavBar from "@/components/NavBar";

type Market = "ALL" | "SG" | "MY" | "TH" | "HK";

interface StoreStatus {
  id: string;
  name: string;
  chain: string;
  market: string;
  tier: "T1" | "T2" | "T3" | "T4" | null;
  last_visit_date: string | null;
}

interface Stats {
  visits_this_month: number;
  visits_all_time: number;
  active_cms_this_month: number;
  total_stores: number;
}

interface User { first_name: string; username?: string }

const MARKET_OPTIONS: { value: Market; label: string }[] = [
  { value: "ALL", label: "All Markets" },
  { value: "SG",  label: "🇸🇬 Singapore" },
  { value: "MY",  label: "🇲🇾 Malaysia" },
  { value: "TH",  label: "🇹🇭 Thailand" },
  { value: "HK",  label: "🇭🇰 Hong Kong" },
];

const TIER_STYLE: Record<string, { bg: string; color: string }> = {
  T1: { bg: "var(--color-tier-t1-bg)", color: "var(--color-tier-t1-fg)" },
  T2: { bg: "var(--color-tier-t2-bg)", color: "var(--color-tier-t2-fg)" },
  T3: { bg: "var(--color-tier-t3-bg)", color: "var(--color-tier-t3-fg)" },
  T4: { bg: "var(--color-tier-t4-bg)", color: "var(--color-tier-t4-fg)" },
};

function daysSince(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

function storeStatusMeta(lastVisit: string | null): { icon: string; label: string; dimmed: boolean } {
  if (!lastVisit) return { icon: "○", label: "Never visited", dimmed: true };
  const d = daysSince(lastVisit);
  if (d === 0) return { icon: "✅", label: "Today",           dimmed: false };
  if (d === 1) return { icon: "✅", label: "Yesterday",        dimmed: false };
  if (d <= 7)  return { icon: "🟢", label: `${d} days ago`,   dimmed: false };
  if (d <= 30) return { icon: "🟡", label: `${d} days ago`,   dimmed: false };
  return       { icon: "🔴", label: `${d} days ago`,           dimmed: false };
}

export default function HomePage() {
  const [user,   setUser]   = useState<User | null>(null);
  const [stats,  setStats]  = useState<Stats | null>(null);
  const [stores, setStores] = useState<StoreStatus[]>([]);
  const [market, setMarket] = useState<Market>("ALL");

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null).then(d => { if (d) setUser(d); });
    fetch("/api/overview").then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setStats(d.stats); setStores(d.stores); }
    });
  }, []);

  if (!user) return null;

  // Filter + group by chain
  const filtered = stores.filter(s => market === "ALL" || s.market === market);
  const byChain = new Map<string, StoreStatus[]>();
  for (const s of filtered) {
    if (!byChain.has(s.chain)) byChain.set(s.chain, []);
    byChain.get(s.chain)!.push(s);
  }
  const chains = [...byChain.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  // Store coverage counts for badge
  const visited = filtered.filter(s => s.last_visit_date).length;

  return (
    <div>
      <NavBar user={user} />
      <div className="page-content">

        {/* KPI row */}
        <div className="kpi-row">
          <div className="kpi-card accent">
            <p className="kpi-value">{stats ? stats.visits_this_month : "—"}</p>
            <p className="kpi-label">Visits this month</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-value">{stats ? stats.active_cms_this_month : "—"}</p>
            <p className="kpi-label">Active CMs</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-value">{stats ? stats.total_stores : "—"}</p>
            <p className="kpi-label">Total stores</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-value">{stats ? stats.visits_all_time : "—"}</p>
            <p className="kpi-label">All-time visits</p>
          </div>
        </div>

        {/* Store status section */}
        <div className="section-header">
          <h2 className="section-title">Store Status</h2>
          {filtered.length > 0 && (
            <span className="section-badge">
              {visited}/{filtered.length} visited
            </span>
          )}
        </div>

        {/* Market chips */}
        <div className="market-chips" style={{ marginBottom: 20 }}>
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

        {/* Chain cards */}
        {stores.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-icon">🏪</p>
            <p>No stores found.</p>
          </div>
        ) : chains.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-icon">🌏</p>
            <p>No stores in this market yet.</p>
          </div>
        ) : (
          <div className="chain-grid">
            {chains.map(([chainName, chainStores]) => (
              <div key={chainName} className="chain-card">
                <div className="chain-card-header">
                  <span className="chain-name">{chainName}</span>
                  <span className="chain-count">{chainStores.length} store{chainStores.length !== 1 ? "s" : ""}</span>
                </div>
                {chainStores.map(store => {
                  const { icon, label, dimmed } = storeStatusMeta(store.last_visit_date);
                  const tier = store.tier;
                  const ts = tier ? TIER_STYLE[tier] : null;
                  return (
                    <div key={store.id} className="store-row">
                      <span className="store-status-icon">{icon}</span>
                      <div className="store-info">
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {ts && (
                            <span className="tier-badge" style={{ background: ts.bg, color: ts.color }}>
                              {tier}
                            </span>
                          )}
                          <span className="store-row-name">{store.name}</span>
                        </div>
                        <p className="store-row-meta" style={{ color: dimmed ? "var(--color-ink-100)" : undefined }}>
                          {label}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
