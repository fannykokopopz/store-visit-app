import { authedCMFromRequest } from "@/lib/miniapp-auth";
import { getFilterOptionsForMarket } from "@/lib/queries";

export async function GET(req: Request) {
  const cm = await authedCMFromRequest(req);
  if (!cm) return Response.json({ error: "Not authorised" }, { status: 401 });

  const payload = await getFilterOptionsForMarket(cm.market, cm.role, cm.telegram_id);
  return Response.json(payload);
}
