"use client";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        ready?: () => void;
        expand?: () => void;
        BackButton?: { show: () => void; hide: () => void; onClick: (cb: () => void) => void };
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;

export function loadTelegramScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if (window.Telegram?.WebApp) return resolve();
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Telegram script failed"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export async function initTelegram(): Promise<string | null> {
  await loadTelegramScript();
  const tg = window.Telegram?.WebApp;
  if (!tg?.initData) return null;
  tg.ready?.();
  tg.expand?.();
  return tg.initData;
}
