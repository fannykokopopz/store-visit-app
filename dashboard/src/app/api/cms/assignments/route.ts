import { NextRequest } from "next/server";
import { requireDashboardRole } from "@/lib/auth";
import { assignStore, unassignStore } from "@/lib/queries";

interface Body { cm_telegram_id?: number; store_id?: string }

async function parseBody(req: NextRequest): Promise<Body | null> {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.cm_telegram_id !== "number" || typeof body.store_id !== "string") return null;
  return body as Body;
}

export async function POST(req: NextRequest) {
  if (!requireDashboardRole(req)) return Response.json({ error: "Not authorised" }, { status: 401 });
  const body = await parseBody(req);
  if (!body) return Response.json({ error: "Invalid body" }, { status: 400 });
  const ok = await assignStore(body.cm_telegram_id!, body.store_id!);
  if (!ok) return Response.json({ error: "Assign failed" }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!requireDashboardRole(req)) return Response.json({ error: "Not authorised" }, { status: 401 });
  const body = await parseBody(req);
  if (!body) return Response.json({ error: "Invalid body" }, { status: 400 });
  const ok = await unassignStore(body.cm_telegram_id!, body.store_id!);
  if (!ok) return Response.json({ error: "Unassign failed" }, { status: 500 });
  return Response.json({ ok: true });
}
