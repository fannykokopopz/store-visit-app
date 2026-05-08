"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const TABS = [
  { href: "/",       label: "Overview"       },
  { href: "/visits", label: "Store Updates"  },
  { href: "/staff",  label: "Staff & Allies" },
];

interface Props {
  user: { first_name: string; username?: string };
}

export default function NavBar({ user }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <>
      <header className="top-bar">
        <div className="top-bar-brand">
          <div className="top-bar-logo">S</div>
          <div>
            <p className="top-bar-title">SVA Dashboard</p>
            <p className="top-bar-sub">TC Acoustic · Store Visits</p>
          </div>
        </div>
        <div className="top-bar-right">
          <span className="top-bar-user">{user.first_name}</span>
          <button onClick={logout} className="top-bar-btn">Sign out</button>
        </div>
      </header>
      <nav className="tab-bar">
        {TABS.map(({ href, label }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={`tab${active ? " active" : ""}`}>
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
