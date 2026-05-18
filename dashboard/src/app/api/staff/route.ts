import { NextRequest } from "next/server";
import { requireDashboardRole } from "@/lib/auth";
import { getAllStaff, setAllyStatus } from "@/lib/queries";

export async function GET(req: NextRequest) {
  if (!requireDashboardRole(req)) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }
  const staff = await getAllStaff();
  return Response.json({ staff });
}

export async function PATCH(req: NextRequest) {
  if (!requireDashboardRole(req)) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body?.id || typeof body.is_ally !== "boolean") {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }
  const ok = await setAllyStatus(body.id, body.is_ally);
  if (!ok) return Response.json({ error: "Update failed" }, { status: 500 });
  return Response.json({ ok: true });
}
