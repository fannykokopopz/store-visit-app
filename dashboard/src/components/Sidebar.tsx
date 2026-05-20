"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/", label: "Overview", icon: "◈" },
  { href: "/visits", label: "Visits", icon: "📋" },
  { href: "/intelligence", label: "Intelligence", icon: "🧠" },
  { href: "/staff", label: "Staff & Allies", icon: "👥" },
];

interface Props {
  user: { first_name: string; username?: string };
}

export default function Sidebar({ user }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="px-5 py-5 border-b" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl text-sm font-black text-white shrink-0"
            style={{ background: "var(--color-tc-500)" }}
          >
            S
          </div>
          <div>
            <p className="text-[13px] font-extrabold leading-tight" style={{ color: "var(--color-ink-900)" }}>
              SVA
            </p>
            <p className="text-[10px]" style={{ color: "var(--color-ink-300)" }}>
              Dashboard
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors"
              style={{
                background: active ? "var(--color-tc-50)" : "transparent",
                color: active ? "var(--color-tc-600)" : "var(--color-ink-500)",
                fontWeight: active ? 700 : 500,
              }}
            >
              <span className="text-base leading-none">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className="px-3 py-4 border-t" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-center gap-2.5 px-2 mb-2">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ background: "var(--color-ink-300)" }}
          >
            {user.first_name[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold" style={{ color: "var(--color-ink-700)" }}>
              {user.first_name}
            </p>
            {user.username && (
              <p className="truncate text-[10px]" style={{ color: "var(--color-ink-300)" }}>
                @{user.username}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full rounded-lg px-3 py-1.5 text-left text-[12px] transition-colors"
          style={{ color: "var(--color-ink-300)" }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
