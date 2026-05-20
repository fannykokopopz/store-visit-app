"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import NavBar from "@/components/NavBar";

interface User { first_name: string; username?: string }

interface Note {
  id: string;
  slug: string;
  scope: "store" | "person" | "theme" | "channel";
  scope_ref: string;
  title: string;
  summary: string;
  body_markdown: string;
  related_slugs: string[];
  version: number;
  tier: "short" | "long";
  last_touched_at: string;
  edited_by_human: boolean;
  created_at: string;
}

interface HistoryEntry {
  version: number;
  edited_by_human: boolean;
  last_touched_at: string;
  created_at: string;
}

interface RelatedNote {
  slug: string;
  title: string;
  summary: string;
}

interface EdgeRow {
  from_slug: string;
  to_slug: string;
  edge_type: string;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NoteDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: encoded } = use(params);
  const slug = decodeURIComponent(encoded);

  const [user, setUser] = useState<User | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [related, setRelated] = useState<RelatedNote[]>([]);
  const [edges, setEdges] = useState<EdgeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [bodyDraft, setBodyDraft] = useState("");
  const [relatedDraft, setRelatedDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)).then((d) => d && setUser(d));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/intelligence/notes/${encodeURIComponent(slug)}`);
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setNote(data.note);
    setHistory(data.history ?? []);
    setRelated(data.related ?? []);
    setEdges(data.edges ?? []);
    if (data.note) {
      setSummaryDraft(data.note.summary);
      setBodyDraft(data.note.body_markdown);
      setRelatedDraft((data.note.related_slugs ?? []).join(", "));
    }
    setLoading(false);
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  async function saveEdit() {
    if (!note) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/intelligence/notes/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: summaryDraft.trim(),
          body_markdown: bodyDraft,
          related_slugs: relatedDraft
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();
      if (res.ok && data.note) {
        setEditing(false);
        await load();
      } else {
        alert(data.error ?? "Save failed");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <NavBar user={user as { first_name: string; username?: string }} />
      <main className="page-content space-y-6">
        <Link href="/intelligence" className="text-[12px] font-medium" style={{ color: "var(--color-tc-600)" }}>
          ← Back to Intelligence
        </Link>

        {loading && <p className="text-[13px]" style={{ color: "var(--color-ink-300)" }}>Loading…</p>}

        {!loading && !note && (
          <div className="rounded-2xl p-6 text-center" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <p className="text-[13px]" style={{ color: "var(--color-ink-300)" }}>Note not found.</p>
          </div>
        )}

        {note && (
          <>
            {/* Header */}
            <header>
              <div className="flex items-center gap-2 mb-2 text-[11px]" style={{ color: "var(--color-ink-300)" }}>
                <span
                  className="rounded-full px-2 py-0.5 font-bold uppercase tracking-wide"
                  style={{
                    background:
                      note.scope === "theme"
                        ? "var(--color-section-purple-bg)"
                        : note.scope === "store"
                        ? "var(--color-section-green-bg)"
                        : note.scope === "person"
                        ? "var(--color-section-blue-bg)"
                        : "var(--color-ink-50)",
                    color: "var(--color-ink-700)",
                  }}
                >
                  {note.scope}
                </span>
                <span>{note.slug}</span>
                <span>· v{note.version}</span>
                <span>· {note.tier}-tier</span>
                {note.edited_by_human && (
                  <span style={{ color: "var(--color-tc-600)" }}>· ✎ edited by human</span>
                )}
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <h1 className="text-2xl font-black tracking-tight" style={{ color: "var(--color-ink-900)" }}>
                  {note.title}
                </h1>
                {!editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors"
                    style={{ background: "var(--color-tc-50)", color: "var(--color-tc-600)" }}
                  >
                    Edit note
                  </button>
                )}
              </div>
              <p className="text-[13px] mt-1" style={{ color: "var(--color-ink-500)" }}>
                {note.summary}
              </p>
            </header>

            {/* Body */}
            <section
              className="rounded-2xl p-6"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              {!editing ? (
                <div className="markdown-brief">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.body_markdown}</ReactMarkdown>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--color-ink-300)" }}>
                      Summary (one-liner, always loaded by Claude)
                    </label>
                    <input
                      value={summaryDraft}
                      onChange={(e) => setSummaryDraft(e.target.value)}
                      className="w-full text-[13px] p-2 rounded-lg"
                      style={{ border: "1px solid var(--color-border)", background: "var(--color-ink-50)" }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--color-ink-300)" }}>
                      Body (markdown, loaded selectively)
                    </label>
                    <textarea
                      value={bodyDraft}
                      onChange={(e) => setBodyDraft(e.target.value)}
                      rows={Math.min(30, Math.max(10, bodyDraft.split("\n").length + 2))}
                      className="w-full font-mono text-[12px] p-3 rounded-lg"
                      style={{ border: "1px solid var(--color-border)", background: "var(--color-ink-50)" }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--color-ink-300)" }}>
                      Related slugs (comma-separated)
                    </label>
                    <input
                      value={relatedDraft}
                      onChange={(e) => setRelatedDraft(e.target.value)}
                      placeholder="theme:bose-popup-rollout, store:bd-vivo"
                      className="w-full text-[12px] font-mono p-2 rounded-lg"
                      style={{ border: "1px solid var(--color-border)", background: "var(--color-ink-50)" }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                      style={{ background: "var(--color-tc-500)" }}
                    >
                      {saving ? "Saving…" : "Save as new version"}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setSummaryDraft(note.summary);
                        setBodyDraft(note.body_markdown);
                        setRelatedDraft(note.related_slugs.join(", "));
                      }}
                      className="rounded-lg px-3 py-1.5 text-[12px] font-medium"
                      style={{ color: "var(--color-ink-500)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Related notes */}
            {related.length > 0 && (
              <section>
                <h2 className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--color-ink-300)" }}>
                  Related notes
                </h2>
                <div className="grid gap-2">
                  {related.map((r) => (
                    <Link
                      key={r.slug}
                      href={`/intelligence/notes/${encodeURIComponent(r.slug)}`}
                      className="rounded-xl p-3 transition-colors"
                      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                    >
                      <p className="text-[12px] font-bold" style={{ color: "var(--color-ink-900)" }}>
                        {r.title}
                      </p>
                      <p className="text-[11.5px]" style={{ color: "var(--color-ink-500)" }}>{r.summary}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* History */}
            {history.length > 1 && (
              <section>
                <h2 className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--color-ink-300)" }}>
                  Version history ({history.length})
                </h2>
                <ul className="space-y-1 text-[11.5px]" style={{ color: "var(--color-ink-500)" }}>
                  {history.map((h) => (
                    <li key={h.version} className="flex items-center gap-2">
                      <span className="font-mono">v{h.version}</span>
                      <span>·</span>
                      <span>{fmtDateTime(h.created_at)}</span>
                      {h.edited_by_human && (
                        <span style={{ color: "var(--color-tc-600)" }}>· ✎ human edit</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {edges.length > 0 && (
              <section>
                <h2 className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--color-ink-300)" }}>
                  Edges ({edges.length})
                </h2>
                <ul className="space-y-1 text-[11px] font-mono" style={{ color: "var(--color-ink-300)" }}>
                  {edges.map((e, i) => (
                    <li key={i}>
                      {e.from_slug} <span style={{ color: "var(--color-ink-500)" }}>—{e.edge_type}→</span> {e.to_slug}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
