"use client";

import { useEffect, useState } from "react";
import NavBar from "@/components/NavBar";

interface User { first_name: string; username?: string }

export default function StaffPage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null).then(d => { if (d) setUser(d); });
  }, []);

  if (!user) return null;

  return (
    <div>
      <NavBar user={user} />
      <div className="page-content">
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "80px 24px", textAlign: "center",
        }}>
          <div style={{
            fontSize: 40, marginBottom: 20,
            width: 72, height: 72, borderRadius: 20,
            background: "var(--color-ink-50)", border: "1px solid var(--color-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            👥
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--color-ink-900)", marginBottom: 8 }}>
            Staff & Allies
          </h2>
          <p style={{ fontSize: 14, color: "var(--color-ink-300)", maxWidth: 360, lineHeight: 1.6 }}>
            Coming soon — we&apos;re still figuring out the right structure with the sales team.
          </p>
        </div>
      </div>
    </div>
  );
}
