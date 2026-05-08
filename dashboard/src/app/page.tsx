"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";

interface Stats {
  visits_this_month: number;
  visits_all_time: number;
  active_cms_this_month: number;
  total_cms: number;
  total_stores: number;
}

interface User { first_name: string; username?: string }

const STAT_CARDS = [
  { key: "visits_this_month",    label: "Visits this month",   accent: true },
  { key: "active_cms_this_month",label: "Active CMs",          accent: false },
  { key: "total_stores",         label: "Total stores",         accent: false },
  { key: "visits_all_time",      label: "All-time visits",      accent: false },
] as const;

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetch("/api/stats").then(r => r.ok ? r.json() : null).then(d => { if (d) setStats(d); });
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null).then(d => { if (d) setUser(d); });
  }, []);

  if (!user) return null;

  return (
    <div className="layout">
      <Sidebar user={user} />
      <main className="main">
        <header
          className="sticky top-0 z-10 px-8 py-5 border-b"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <h1 className="text-lg font-extrabold" style={{ color: "var(--color-ink-900)" }}>
            Overview
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-ink-300)" }}>
            Team performance at a glance
          </p>
        </header>

        <div className="px-8 py-6">
          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {STAT_CARDS.map(({ key, label, accent }) => (
              <div
                key={key}
                className="rounded-2xl p-5"
                style={{
                  background: accent ? "var(--color-tc-50)" : "var(--color-surface)",
                  border: `1px solid ${accent ? "var(--color-tc-100)" : "var(--color-border)"}`,
                }}
              >
                <p
                  className="text-3xl font-extrabold leading-none mb-2"
                  style={{ color: accent ? "var(--color-tc-600)" : "var(--color-ink-900)" }}
                >
                  {stats ? stats[key] : "—"}
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-300)" }}>
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 gap-4">
            <Link
              href="/visits"
              className="rounded-2xl p-6 flex flex-col gap-3 transition-shadow hover:shadow-md"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <span className="text-2xl">📋</span>
              <div>
                <p className="font-extrabold text-[15px]" style={{ color: "var(--color-ink-900)" }}>
                  Visit Feed
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--color-ink-300)" }}>
                  All store visits · filter by CM, store, or date
                </p>
              </div>
            </Link>
            <Link
              href="/staff"
              className="rounded-2xl p-6 flex flex-col gap-3 transition-shadow hover:shadow-md"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <span className="text-2xl">👥</span>
              <div>
                <p className="font-extrabold text-[15px]" style={{ color: "var(--color-ink-900)" }}>
                  Staff & Allies
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--color-ink-300)" }}>
                  Store staff directory · mark allies
                </p>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
