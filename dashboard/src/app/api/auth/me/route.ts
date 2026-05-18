import { NextRequest } from "next/server";
import { requireDashboardRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = requireDashboardRole(req);
  if (!user) return Response.json({ error: "Not authorised" }, { status: 401 });
  return Response.json({
    first_name: user.first_name,
    username: user.username,
    role: user.role,
  });
}
