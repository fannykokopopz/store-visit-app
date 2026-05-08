import { authedCMFromRequest } from "@/lib/miniapp-auth";
import { searchVisitsInMarket } from "@/lib/queries";

export async function GET(req: Request) {
  const cm = await authedCMFromRequest(req);
  if (!cm) return Response.json({ error: "Not authorised" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const section = url.searchParams.get("section") ?? undefined;

  if (q.length < 2) return Response.json({ results: [] });

  const results = await searchVisitsInMarket(cm.market, q, section);
  return Response.json({ results });
}
