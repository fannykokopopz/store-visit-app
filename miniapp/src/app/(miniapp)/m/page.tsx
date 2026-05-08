"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { initTelegram } from "./telegram-init";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PortfolioStore {
  id: string;
  name: string;
  chain: string;
  tier: "T1" | "T2" | "T3" | "T4" | null;
  last_visit_date: string | null;
  last_visit_id: string | null;
  visits_30d: number;
}

interface AllMarketStore {
  id: string;
  name: string;
  chain: string;
  tier: "T1" | "T2" | "T3" | "T4" | null;
  last_visit_date: string | null;
  last_visit_cm: string | null;
}

interface SearchResult {
  id: string;
  visit_date: string;
  store_id: string;
  store_name: string;
  store_chain: string;
  store_tier: "T1" | "T2" | "T3" | "T4" | null;
  cm_name: string;
  good_news: string | null;
  competitors: string | null;
  display_stock: string | null;
  follow_up: string | null;
  buzz_plan: string | null;
  training: string | null;
}

interface Portfolio {
  cm: { name: string; market: string; nickname: string | null };
  stores: PortfolioStore[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const OVERDUE_DAYS: Record<string, number> = { T1: 7, T2: 14, T3: 30, T4: 90 };

const TIER_STYLE: Record<string, string> = {
  T1: "bg-[var(--color-tier-t1-bg)] text-[var(--color-tier-t1-fg)]",
  T2: "bg-[var(--color-tier-t2-bg)] text-[var(--color-tier-t2-fg)]",
  T3: "bg-[var(--color-tier-t3-bg)] text-[var(--color-tier-t3-fg)]",
  T4: "bg-[var(--color-tier-t4-bg)] text-[var(--color-tier-t4-fg)]",
};

const SECTION_LABELS: Record<string, string> = {
  good_news: "Good News",
  competitors: "Competitors",
  display_stock: "Display & Stock",
  follow_up: "Follow Up",
  buzz_plan: "Buzz Plan",
  training: "Training",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const then = new Date(dateStr); then.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - then.getTime()) / 86400000);
}

function lastVisitLabel(dateStr: string | null): string {
  const d = daysSince(dateStr);
  if (d === null) return "Never visited";
  if (d <= 0) return "Visited today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  if (d < 14) return "Over a week ago";
  if (d < 30) return "Over 2 weeks ago";
  if (d < 60) return "Over a month ago";
  return "Over 2 months ago";
}

function visitAgoClass(dateStr: string | null, tier: string | null): string {
  const d = daysSince(dateStr);
  if (d === null) return "text-ink-300";
  if (d <= 1) return "text-[var(--color-tier-t2-fg)] font-semibold";
  const threshold = tier ? (OVERDUE_DAYS[tier] ?? 14) : 14;
  if (d > threshold) return "text-[var(--color-status-bad-fg)] font-semibold";
  if (d > threshold * 0.7) return "text-[var(--color-status-warn-fg)] font-semibold";
  return "text-ink-400 font-medium";
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function highlight(text: string | null, query: string): string {
  if (!text || !query) return text ?? "";
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, 80) + (text.length > 80 ? "…" : "");
  const start = Math.max(0, idx - 20);
  const snippet = (start > 0 ? "…" : "") + text.slice(start, idx + query.length + 40);
  return snippet.length < text.length ? snippet + "…" : snippet;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-center text-sm text-ink-300">Loading…</p>
      </main>
    }>
      <PortfolioContent />
    </Suspense>
  );
}

function PortfolioContent() {
  const urlParams = useSearchParams();
  const initialTab = urlParams.get("tab") === "all" ? "all" : "my";

  const [tab, setTab] = useState<"my" | "all">(initialTab as "my" | "all");
  const [data, setData] = useState<Portfolio | null>(null);
  const [allStores, setAllStores] = useState<AllMarketStore[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [initData, setInitData] = useState<string | null>(null);

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSection, setSearchSection] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Settings state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nickInput, setNickInput] = useState("");
  const [nickSaving, setNickSaving] = useState(false);
  const [nickSaved, setNickSaved] = useState(false);

  // Bootstrap
  useEffect(() => {
    setDismissed(!!localStorage.getItem("sva-onboard-dismissed"));
    (async () => {
      const id = await initTelegram();
      if (!id) { setError("Open this from inside Telegram."); return; }
      setInitData(id);
      const res = await fetch("/api/m/portfolio", { headers: { Authorization: `tma ${id}` } });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Failed (${res.status})`);
        return;
      }
      const payload = await res.json();
      setData(payload);
      setNickInput(payload.cm.nickname ?? payload.cm.name.split(" ")[0]);
    })().catch((e) => setError(String(e)));
  }, []);

  // Lazy-load All Stores tab
  useEffect(() => {
    if (tab !== "all" || allStores !== null || !initData) return;
    fetch("/api/m/stores", { headers: { Authorization: `tma ${initData}` } })
      .then((r) => r.json())
      .then((j) => setAllStores(j.stores ?? []))
      .catch(() => setAllStores([]));
  }, [tab, allStores, initData]);

  // Debounced search
  const doSearch = useCallback(
    async (q: string, section: string) => {
      if (!initData || q.trim().length < 2) { setSearchResults(null); return; }
      setSearching(true);
      try {
        const url = `/api/m/search?q=${encodeURIComponent(q)}${section ? `&section=${section}` : ""}`;
        const res = await fetch(url, { headers: { Authorization: `tma ${initData}` } });
        const j = await res.json();
        setSearchResults(j.results ?? []);
      } finally {
        setSearching(false);
      }
    },
    [initData],
  );

  useEffect(() => {
    if (!searchOpen) return;
    const t = setTimeout(() => doSearch(searchQuery, searchSection), 350);
    return () => clearTimeout(t);
  }, [searchQuery, searchSection, searchOpen, doSearch]);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 50);
  }, [searchOpen]);

  function openSearch() { setSearchOpen(true); setSearchQuery(""); setSearchSection(""); setSearchResults(null); }
  function closeSearch() { setSearchOpen(false); setSearchQuery(""); setSearchResults(null); }

  async function saveNickname() {
    if (!initData || !nickInput.trim()) return;
    setNickSaving(true);
    const res = await fetch("/api/m/whoami", {
      method: "PATCH",
      headers: { Authorization: `tma ${initData}`, "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: nickInput.trim() }),
    });
    setNickSaving(false);
    if (res.ok) {
      setNickSaved(true);
      if (data) setData({ ...data, cm: { ...data.cm, nickname: nickInput.trim() } });
      setTimeout(() => { setNickSaved(false); setSettingsOpen(false); }, 800);
    }
  }

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

  const displayName = data.cm.nickname ?? data.cm.name.split(" ")[0];

  return (
    <>
      <main className="min-h-screen pb-12">
        {/* Header */}
        <header className="bg-white border-b border-ink-100 px-4 pt-5 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-300 mb-1">
                Good day
              </p>
              <h1 className="text-[28px] font-extrabold leading-tight text-ink-700">{displayName}</h1>
              <p className="text-xs text-ink-300 mt-0.5">
                {data.stores.length} stores · {data.cm.market}
              </p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={openSearch}
                className="h-9 w-9 flex items-center justify-center rounded-xl bg-ink-100 text-ink-400 text-base"
                aria-label="Search"
              >
                🔍
              </button>
              <button
                onClick={() => setSettingsOpen(true)}
                className="h-9 w-9 flex items-center justify-center rounded-xl bg-ink-100 text-ink-400 text-base"
                aria-label="Settings"
              >
                ⚙️
              </button>
            </div>
          </div>
        </header>

        {/* Tab bar */}
        <div className="bg-white border-b border-ink-100 flex">
          {(["my", "all"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-[13px] font-semibold transition-colors ${
                tab === t
                  ? "text-[var(--color-tc-600)] border-b-2 border-[var(--color-tc-600)]"
                  : "text-ink-300"
              }`}
            >
              {t === "my" ? "My Stores" : "All Stores"}
            </button>
          ))}
        </div>

        {/* My Stores tab */}
        {tab === "my" && (
          <>
            {!dismissed && (
              <div className="mx-3.5 mt-3 rounded-2xl border border-[var(--color-tc-100)] bg-[var(--color-tc-50)] p-3.5">
                <div className="flex gap-3 items-start">
                  <span className="text-lg mt-0.5">👋</span>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-ink-700 mb-0.5">Getting started</p>
                    <p className="text-xs text-[var(--color-tc-600)] leading-relaxed">
                      Tap any store to see its visit history. Use <strong>/visit</strong> in the bot to log a new visit.
                    </p>
                    <button
                      onClick={() => { localStorage.setItem("sva-onboard-dismissed", "1"); setDismissed(true); }}
                      className="mt-2 text-[11px] font-semibold text-[var(--color-tc-600)] bg-[var(--color-tc-100)] rounded-md px-2.5 py-1 cursor-pointer"
                    >
                      Got it
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(() => {
              const visited = data.stores.filter((s) => s.last_visit_date);
              const unvisited = data.stores.filter((s) => !s.last_visit_date);
              return (
                <>
                  {visited.length > 0 && (
                    <section className="mt-4">
                      <h2 className="px-4 pb-2 text-[10px] font-bold uppercase tracking-widest text-ink-300">
                        Recently visited
                      </h2>
                      <ul className="space-y-2 px-3.5">
                        {visited.map((s) => <MyStoreCard key={s.id} store={s} />)}
                      </ul>
                    </section>
                  )}
                  {unvisited.length > 0 && (
                    <section className="mt-4">
                      <h2 className="px-4 pb-2 text-[10px] font-bold uppercase tracking-widest text-ink-300">
                        Never visited
                      </h2>
                      <ul className="space-y-2 px-3.5">
                        {unvisited.map((s) => <MyStoreCard key={s.id} store={s} />)}
                      </ul>
                    </section>
                  )}
                </>
              );
            })()}
          </>
        )}

        {/* All Stores tab */}
        {tab === "all" && (
          <section className="mt-4">
            {allStores === null ? (
              <p className="text-center text-sm text-ink-300 py-8">Loading…</p>
            ) : allStores.length === 0 ? (
              <p className="text-center text-sm text-ink-300 py-8">No stores in {data.cm.market}</p>
            ) : (
              <>
                <h2 className="px-4 pb-2 text-[10px] font-bold uppercase tracking-widest text-ink-300">
                  {allStores.length} stores · {data.cm.market}
                </h2>
                <ul className="space-y-2 px-3.5">
                  {allStores.map((s) => <AllStoreCard key={s.id} store={s} />)}
                </ul>
              </>
            )}
          </section>
        )}
      </main>

      {/* Search overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-40 bg-[var(--color-ink-50)] flex flex-col">
          {/* Search header */}
          <div className="bg-white border-b border-ink-100 px-4 pt-5 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 bg-ink-100 rounded-xl px-3 h-10">
                <span className="text-ink-300 text-sm">🔍</span>
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search visit notes…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-ink-700 placeholder:text-ink-300 outline-none"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="text-ink-300 text-lg leading-none">×</button>
                )}
              </div>
              <button onClick={closeSearch} className="text-sm font-semibold text-ink-400 shrink-0">
                Cancel
              </button>
            </div>

            {/* Section filter chips */}
            <div className="flex gap-1.5 mt-2.5 overflow-x-auto pb-0.5 no-scrollbar">
              {[{ value: "", label: "All" }, ...Object.entries(SECTION_LABELS).map(([v, l]) => ({ value: v, label: l }))].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setSearchSection(value)}
                  className={`shrink-0 text-[11px] font-semibold rounded-full px-3 py-1 transition-colors ${
                    searchSection === value
                      ? "bg-[var(--color-tc-600)] text-white"
                      : "bg-ink-100 text-ink-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto">
            {searching && (
              <p className="text-center text-sm text-ink-300 py-8">Searching…</p>
            )}
            {!searching && searchQuery.length >= 2 && searchResults !== null && searchResults.length === 0 && (
              <p className="text-center text-sm text-ink-300 py-8">No results for &ldquo;{searchQuery}&rdquo;</p>
            )}
            {!searching && searchResults && searchResults.length > 0 && (
              <ul className="space-y-2 p-3.5">
                {searchResults.map((r) => (
                  <SearchResultCard key={r.id} result={r} query={searchQuery} />
                ))}
              </ul>
            )}
            {!searching && searchQuery.length < 2 && (
              <p className="text-center text-sm text-ink-300 py-8">Type at least 2 characters to search</p>
            )}
          </div>
        </div>
      )}

      {/* Settings bottom sheet */}
      {settingsOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setSettingsOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl px-5 pt-5 pb-8 shadow-xl">
            <div className="w-8 h-1 bg-ink-200 rounded-full mx-auto mb-5" />
            <h2 className="text-base font-extrabold text-ink-700 mb-4">Settings</h2>

            <label className="block text-[11px] font-semibold uppercase tracking-wide text-ink-300 mb-1.5">
              Display name
            </label>
            <input
              type="text"
              value={nickInput}
              onChange={(e) => setNickInput(e.target.value)}
              maxLength={30}
              placeholder="Your name"
              className="w-full rounded-xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-700 outline-none focus:border-[var(--color-tc-500)]"
            />
            <p className="text-[11px] text-ink-300 mt-1">This is how the bot and mini app will greet you.</p>

            <button
              onClick={saveNickname}
              disabled={nickSaving || !nickInput.trim()}
              className="mt-4 w-full rounded-xl py-3 text-sm font-bold text-white transition-colors disabled:opacity-50"
              style={{ background: nickSaved ? "#1E7A3A" : "var(--color-tc-600)" }}
            >
              {nickSaved ? "✓ Saved" : nickSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </>
      )}
    </>
  );
}

// ── Store cards ───────────────────────────────────────────────────────────────

function MyStoreCard({ store }: { store: PortfolioStore }) {
  const tierStyle = store.tier ? TIER_STYLE[store.tier] : TIER_STYLE.T4;
  const agoClass = visitAgoClass(store.last_visit_date, store.tier);

  return (
    <li>
      <Link
        href={`/m/store/${store.id}`}
        className="flex items-center gap-3 rounded-[18px] border border-ink-100 bg-white p-3.5 shadow-sm active:scale-[0.98] transition-transform"
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-extrabold ${tierStyle}`}>
          {store.tier ?? "—"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink-700">{store.name}</p>
          <p className="text-[11px] text-ink-300 mt-0.5">{store.chain}</p>
          <div className="flex items-center justify-between mt-1.5">
            <span className={`text-[11px] ${agoClass}`}>{lastVisitLabel(store.last_visit_date)}</span>
            {store.visits_30d > 0 && (
              <span className="text-[9px] font-bold bg-[var(--color-tc-50)] text-[var(--color-tc-600)] rounded-full px-2 py-0.5">
                {store.visits_30d} in 30d
              </span>
            )}
          </div>
        </div>
        <span className="text-ink-200 text-lg">›</span>
      </Link>
    </li>
  );
}

function AllStoreCard({ store }: { store: AllMarketStore }) {
  const tierStyle = store.tier ? TIER_STYLE[store.tier] : TIER_STYLE.T4;
  const agoClass = visitAgoClass(store.last_visit_date, store.tier);

  return (
    <li>
      <Link
        href={`/m/store/${store.id}?all=true`}
        className="flex items-center gap-3 rounded-[18px] border border-ink-100 bg-white p-3.5 shadow-sm active:scale-[0.98] transition-transform"
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-extrabold ${tierStyle}`}>
          {store.tier ?? "—"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink-700">{store.name}</p>
          <p className="text-[11px] text-ink-300 mt-0.5">{store.chain}</p>
          <div className="mt-1.5">
            <span className={`text-[11px] ${agoClass}`}>{lastVisitLabel(store.last_visit_date)}</span>
            {store.last_visit_cm && store.last_visit_date && (
              <span className="text-[11px] text-ink-300"> · {store.last_visit_cm}</span>
            )}
          </div>
        </div>
        <span className="text-ink-200 text-lg">›</span>
      </Link>
    </li>
  );
}

function SearchResultCard({ result, query }: { result: SearchResult; query: string }) {
  const tierStyle = result.store_tier ? TIER_STYLE[result.store_tier] : TIER_STYLE.T4;
  const sections = [
    { key: "good_news", label: "Good News", value: result.good_news },
    { key: "competitors", label: "Competitors", value: result.competitors },
    { key: "display_stock", label: "Display & Stock", value: result.display_stock },
    { key: "follow_up", label: "Follow Up", value: result.follow_up },
    { key: "buzz_plan", label: "Buzz Plan", value: result.buzz_plan },
    { key: "training", label: "Training", value: result.training },
  ].filter((s) => s.value?.toLowerCase().includes(query.toLowerCase()));

  return (
    <li>
      <Link
        href={`/m/visit/${result.id}`}
        className="block rounded-[18px] border border-ink-100 bg-white p-3.5 shadow-sm active:scale-[0.98] transition-transform"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-lg ${tierStyle}`}>
            {result.store_tier ?? "—"}
          </span>
          <span className="text-sm font-bold text-ink-700 truncate">{result.store_name}</span>
        </div>
        <p className="text-[11px] text-ink-300 mb-2">
          {fmtDate(result.visit_date)} · {result.cm_name}
        </p>
        {sections.map((s) => (
          <div key={s.key} className="mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-ink-300">{s.label} </span>
            <span className="text-[12px] text-ink-500">{highlight(s.value, query)}</span>
          </div>
        ))}
      </Link>
    </li>
  );
}
