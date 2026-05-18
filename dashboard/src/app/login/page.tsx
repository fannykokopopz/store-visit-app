"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

const ERROR_MESSAGES: Record<string, string> = {
  not_registered: "This Telegram account isn't registered as a CM. Ask an admin to add you via /grantaccess.",
  cm_only: "The dashboard is for AMs, CM ICs, and Admins only. CMs should use the Telegram bot or mini-app.",
};

function LoginContent() {
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "";
  const searchParams = useSearchParams();
  const errorKey = searchParams.get("error");
  const errorMsg = errorKey ? ERROR_MESSAGES[errorKey] ?? "Login failed. Please try again." : null;

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

        {errorMsg && (
          <div
            style={{
              background: "#FBE6E2",
              color: "#B5331A",
              border: "1px solid #F5BDA5",
              borderRadius: 12,
              padding: "10px 14px",
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 16,
              textAlign: "left",
            }}
          >
            {errorMsg}
          </div>
        )}

        {botUsername ? (
          <div id="tg-widget" className="flex justify-center" />
        ) : (
          <p className="text-xs" style={{ color: "var(--color-ink-300)" }}>
            Set <code>NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code> to enable login.
          </p>
        )}

        <p className="mt-6 text-xs" style={{ color: "var(--color-ink-300)" }}>
          AM / CM IC / Admin only. Log in with the same Telegram account registered in the bot.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
