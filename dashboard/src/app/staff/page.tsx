"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";

interface StaffRow {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  is_ally: boolean;
  ally_since: string | null;
  store_id: string;
  store_name: string;
  store_chain: string;
  store_tier: "T1" | "T2" | "T3" | "T4" | null;
}

interface User { first_name: string; username?: string }

const TIER_STYLE: Record<string, { bg: string; color: string }> = {
  T1: { bg: "var(--color-tier-t1-bg)", color: "var(--color-tier-t1-fg)" },
  T2: { bg: "var(--color-tier-t2-bg)", color: "var(--color-tier-t2-fg)" },
  T3: { bg: "var(--color-tier-t3-bg)", color: "var(--color-tier-t3-fg)" },
  T4: { bg: "var(--color-tier-t4-bg)", color: "var(--color-tier-t4-fg)" },
};

export default function StaffPage() {
  const [user, setUser] = useState<User | null>(null);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [filterAlly, setFilterAlly] = useState<"all" | "ally" | "none">("all");

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null).then(d => { if (d) setUser(d); });
    fetch("/api/staff").then(r => r.ok ? r.json() : null).then(d => {
      if (d) setStaff(d.staff);
      setLoading(false);
    });
  }, []);

  async function toggleAlly(id: string, current: boolean) {
    setToggling(id);
    const res = await fetch("/api/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_ally: !current }),
    });
    if (res.ok) {
      setStaff(prev => prev.map(s =>
        s.id === id ? { ...s, is_ally: !current, ally_since: !current ? new Date().toISOString() : null } : s
      ));
    }
    setToggling(null);
  }

  if (!user) return null;

  // Group staff by store
  const grouped = new Map<string, { store: StaffRow; members: StaffRow[] }>();
  for (const s of staff) {
    if (!grouped.has(s.store_id)) grouped.set(s.store_id, { store: s, members: [] });
    grouped.get(s.store_id)!.members.push(s);
  }

  const filtered = [...grouped.values()].map(g => ({
    ...g,
    members: filterAlly === "all" ? g.members
      : filterAlly === "ally" ? g.members.filter(m => m.is_ally)
      : g.members.filter(m => !m.is_ally),
  })).filter(g => g.members.length > 0);

  const allyCount = staff.filter(s => s.is_ally).length;

  return (
    <div className="layout">
      <Sidebar user={user} />
      <main className="main">
        <header
          className="sticky top-0 z-10 px-8 py-5 border-b"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-extrabold" style={{ color: "var(--color-ink-900)" }}>
                Staff & Allies
              </h1>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-ink-300)" }}>
                {staff.length} staff · {allyCount} allies across {grouped.size} stores
              </p>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--color-ink-50)" }}>
              {(["all", "ally", "none"] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setFilterAlly(v)}
                  className="rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all"
                  style={{
                    background: filterAlly === v ? "var(--color-surface)" : "transparent",
                    color: filterAlly === v ? "var(--color-ink-700)" : "var(--color-ink-300)",
                    boxShadow: filterAlly === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  {v === "all" ? "All" : v === "ally" ? "⭐ Allies" : "Others"}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="px-8 py-6 space-y-6">
          {loading && (
            <p className="text-sm text-center py-12" style={{ color: "var(--color-ink-300)" }}>Loading…</p>
          )}

          {!loading && filtered.length === 0 && (
            <p className="text-sm text-center py-12" style={{ color: "var(--color-ink-300)" }}>No staff found.</p>
          )}

          {filtered.map(({ store, members }) => {
            const tier = store.store_tier;
            const ts = tier ? TIER_STYLE[tier] : TIER_STYLE.T4;

            return (
              <div key={store.store_id} className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
                {/* Store header */}
                <div
                  className="px-5 py-3.5 flex items-center gap-3 border-b"
                  style={{ background: "var(--color-ink-50)", borderColor: "var(--color-border)" }}
                >
                  {tier && (
                    <span
                      className="tier-badge"
                      style={{ background: ts.bg, color: ts.color }}
                    >
                      {tier}
                    </span>
                  )}
                  <div>
                    <p className="font-extrabold text-[14px]" style={{ color: "var(--color-ink-900)" }}>
                      {store.store_name}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--color-ink-300)" }}>{store.store_chain}</p>
                  </div>
                  <span className="ml-auto text-[11px]" style={{ color: "var(--color-ink-300)" }}>
                    {members.length} {members.length === 1 ? "person" : "people"}
                  </span>
                </div>

                {/* Staff rows */}
                <div style={{ background: "var(--color-surface)" }}>
                  {members.map((m, i) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-4 px-5 py-3.5"
                      style={{ borderTop: i > 0 ? `1px solid var(--color-border)` : "none" }}
                    >
                      {/* Avatar */}
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
                        style={{
                          background: m.is_ally ? "var(--color-tc-50)" : "var(--color-ink-100)",
                          color: m.is_ally ? "var(--color-tc-600)" : "var(--color-ink-300)",
                        }}
                      >
                        {m.name[0]?.toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[13px]" style={{ color: "var(--color-ink-900)" }}>
                            {m.name}
                          </span>
                          {m.is_ally && (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: "var(--color-tc-50)", color: "var(--color-tc-600)" }}
                            >
                              ⭐ Ally
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {m.role && (
                            <span className="text-[11px]" style={{ color: "var(--color-ink-300)" }}>{m.role}</span>
                          )}
                          {m.phone && (
                            <a
                              href={`tel:${m.phone}`}
                              className="text-[11px]"
                              style={{ color: "var(--color-ink-300)" }}
                              onClick={e => e.stopPropagation()}
                            >
                              {m.phone}
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Ally toggle */}
                      <button
                        onClick={() => toggleAlly(m.id, m.is_ally)}
                        disabled={toggling === m.id}
                        className="shrink-0 rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-all disabled:opacity-50"
                        style={m.is_ally ? {
                          background: "var(--color-tc-50)",
                          color: "var(--color-tc-600)",
                          border: "1px solid var(--color-tc-100)",
                        } : {
                          background: "var(--color-ink-50)",
                          color: "var(--color-ink-400)",
                          border: "1px solid var(--color-border)",
                        }}
                      >
                        {toggling === m.id ? "…" : m.is_ally ? "Remove ally" : "Mark ally"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
