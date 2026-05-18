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
    <div className="min-h-screen pb-[72px]">
      {children}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--color-ink-100)] flex pt-2 pb-3 z-50">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center gap-0.5 select-none transition-colors ${
                active ? "text-[var(--color-ink-700)]" : "text-[var(--color-ink-300)]"
              }`}
              prefetch
            >
              <span className="text-[20px] leading-none">{tab.icon}</span>
              <span className="text-[10px] font-bold tracking-wider">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
