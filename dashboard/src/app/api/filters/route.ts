import { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getCMsList, getStoresList } from "@/lib/queries";

export async function GET(req: NextRequest) {
  if (!getSessionFromRequest(req)) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }
  const [cms, stores] = await Promise.all([getCMsList(), getStoresList()]);
  return Response.json({ cms, stores });
}
