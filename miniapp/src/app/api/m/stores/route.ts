import { authedCMFromRequest } from "@/lib/miniapp-auth";
import { getAllStoresInMarket } from "@/lib/queries";

export async function GET(req: Request) {
  const cm = await authedCMFromRequest(req);
  if (!cm) return Response.json({ error: "Not authorised" }, { status: 401 });
  const stores = await getAllStoresInMarket(cm.market, cm.telegram_id);
  return Response.json({ stores });
}
