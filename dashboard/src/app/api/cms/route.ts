import { NextRequest } from "next/server";
import { requireDashboardRole } from "@/lib/auth";
import { getCMsWithAssignments, getStoresList } from "@/lib/queries";

export async function GET(req: NextRequest) {
  if (!requireDashboardRole(req)) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }
  const [cms, stores] = await Promise.all([getCMsWithAssignments(), getStoresList()]);
  return Response.json({ cms, stores });
}
