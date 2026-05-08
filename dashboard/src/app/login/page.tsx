"use client";

import { useEffect } from "react";

export default function LoginPage() {
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "";

  useEffect(() => {
    if (!botUsername) return;
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-auth-url", "/api/auth/telegram");
    script.setAttribute("data-request-access", "write");
    script.async = true;
    document.getElementById("tg-widget")?.appendChild(script);
  }, [botUsername]);

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--color-bg)" }}>
      <div
        className="w-full max-w-sm rounded-2xl p-8 text-center"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        {/* Logo */}
        <div
          className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-black text-white"
          style={{ background: "var(--color-tc-500)" }}
        >
          S
        </div>
        <h1 className="text-xl font-extrabold mb-1" style={{ color: "var(--color-ink-900)" }}>
          SVA Dashboard
        </h1>
        <p className="text-sm mb-7" style={{ color: "var(--color-ink-300)" }}>
          TC Acoustic · Store Visit App
        </p>

        {botUsername ? (
          <div id="tg-widget" className="flex justify-center" />
        ) : (
          <p className="text-xs" style={{ color: "var(--color-ink-300)" }}>
            Set <code>NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code> to enable login.
          </p>
        )}

        <p className="mt-6 text-xs" style={{ color: "var(--color-ink-300)" }}>
          Log in with the same Telegram account registered in the bot.
        </p>
      </div>
    </div>
  );
}
