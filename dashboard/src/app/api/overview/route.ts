import { NextRequest } from "next/server";
import { requireDashboardRole } from "@/lib/auth";
import { getTeamStats, getStoreStatus } from "@/lib/queries";

export async function GET(req: NextRequest) {
  if (!requireDashboardRole(req)) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }
  const [stats, stores] = await Promise.all([getTeamStats(), getStoreStatus()]);
  return Response.json({ stats, stores });
}
