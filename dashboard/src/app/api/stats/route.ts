import { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getTeamStats } from "@/lib/queries";

export async function GET(req: NextRequest) {
  if (!getSessionFromRequest(req)) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }
  const stats = await getTeamStats();
  return Response.json(stats);
}
