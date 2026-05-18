import { NextRequest } from "next/server";
import {
  verifyTelegramHash,
  createSessionCookie,
  COOKIE_NAME,
  COOKIE_OPTS,
  DASHBOARD_ROLES,
  type DashboardRole,
} from "@/lib/auth";
import { getCMByTelegramId } from "@/lib/queries";

function redirect(url: string, headers?: Record<string, string>): Response {
  const res = new Response(null, { status: 302, headers: { Location: url, ...headers } });
  return res;
}

function clearedCookieHeader(): string {
  return `${COOKIE_NAME}=; Path=${COOKIE_OPTS.path}; HttpOnly; SameSite=${COOKIE_OPTS.sameSite}; Max-Age=0${COOKIE_OPTS.secure ? "; Secure" : ""}`;
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());

  if (!verifyTelegramHash(params)) {
    return new Response("Invalid Telegram auth", { status: 403 });
  }

  // auth_date must be within 24h
  const authDate = Number(params.auth_date ?? 0);
  if (Date.now() / 1000 - authDate > 86400) {
    return new Response("Auth expired", { status: 403 });
  }

  const telegramId = Number(params.id);
  if (!Number.isFinite(telegramId)) {
    return new Response("Invalid Telegram id", { status: 400 });
  }

  // Dashboard is AM / CM IC / Admin only — look up the user's role
  const cm = await getCMByTelegramId(telegramId);
  if (!cm || !cm.is_active) {
    const r = redirect("/login?error=not_registered");
    r.headers.append("Set-Cookie", clearedCookieHeader());
    return r;
  }
  if (!DASHBOARD_ROLES.includes(cm.role as DashboardRole)) {
    const r = redirect("/login?error=cm_only");
    r.headers.append("Set-Cookie", clearedCookieHeader());
    return r;
  }

  const cookie = createSessionCookie({
    id: telegramId,
    first_name: params.first_name ?? cm.full_name,
    last_name: params.last_name,
    username: params.username,
    role: cm.role as DashboardRole,
  });

  const res = redirect("/");
  res.headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${cookie}; Path=${COOKIE_OPTS.path}; HttpOnly; SameSite=${COOKIE_OPTS.sameSite}; Max-Age=${COOKIE_OPTS.maxAge}${COOKIE_OPTS.secure ? "; Secure" : ""}`,
  );
  return res;
}
