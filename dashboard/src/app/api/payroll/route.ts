import { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getPayrollGrid } from "@/lib/queries";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function defaultRange(): { from: string; to: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = new Date(today);
  from.setDate(today.getDate() - 27); // ~4 weeks back
  return { from: from.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
}

export async function GET(req: NextRequest) {
  if (!getSessionFromRequest(req)) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }
  const url = new URL(req.url);
  const def = defaultRange();
  const fromRaw = url.searchParams.get("from");
  const toRaw   = url.searchParams.get("to");
  const from = fromRaw && ISO.test(fromRaw) ? fromRaw : def.from;
  const to   = toRaw   && ISO.test(toRaw)   ? toRaw   : def.to;
  const grid = await getPayrollGrid(from, to);
  return Response.json(grid);
}
