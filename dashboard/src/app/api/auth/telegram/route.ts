import { NextRequest } from "next/server";
import {
  verifyTelegramHash,
  createSessionCookie,
  COOKIE_NAME,
  COOKIE_OPTS,
} from "@/lib/auth";

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

  const cookie = createSessionCookie({
    id: Number(params.id),
    first_name: params.first_name ?? "",
    last_name: params.last_name,
    username: params.username,
  });

  const res = new Response(null, {
    status: 302,
    headers: { Location: "/" },
  });
  res.headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${cookie}; Path=${COOKIE_OPTS.path}; HttpOnly; SameSite=${COOKIE_OPTS.sameSite}; Max-Age=${COOKIE_OPTS.maxAge}${COOKIE_OPTS.secure ? "; Secure" : ""}`,
  );
  return res;
}
