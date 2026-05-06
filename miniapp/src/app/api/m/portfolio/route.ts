import { authedCMFromRequest } from "@/lib/miniapp-auth";
import { getPortfolioForCM } from "@/lib/queries";

export async function GET(req: Request) {
  const cm = await authedCMFromRequest(req);
  if (!cm) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }
  const stores = await getPortfolioForCM(cm.telegram_id);
  return Response.json({ cm: { name: cm.full_name, market: cm.market }, stores });
}
