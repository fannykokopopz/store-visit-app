"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/m/stats", label: "Stats", icon: "📊" },
  { href: "/m/visits", label: "Visits", icon: "📝" },
  { href: "/m/stores", label: "Stores", icon: "🏬" },
];

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen pb-[88px]">
      {children}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--color-ink-100)] flex pt-3 pb-5 z-50">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center gap-1 select-none transition-colors ${
                active ? "text-[var(--color-ink-700)]" : "text-[var(--color-ink-300)]"
              }`}
              prefetch
            >
              <span className="text-[26px] leading-none">{tab.icon}</span>
              <span className="text-[11px] font-bold tracking-wider">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
