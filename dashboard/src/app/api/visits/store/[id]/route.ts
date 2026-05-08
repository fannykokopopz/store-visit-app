import { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getStoreDashboard } from "@/lib/queries";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!getSessionFromRequest(req)) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }
  const { id } = await params;
  const result = await getStoreDashboard(id);
  return Response.json(result);
}
