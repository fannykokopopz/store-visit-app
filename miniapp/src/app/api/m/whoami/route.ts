import { authedCMFromRequest } from "@/lib/miniapp-auth";

export async function GET(req: Request) {
  const cm = await authedCMFromRequest(req);
  if (!cm) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }
  return Response.json({
    telegram_id: cm.telegram_id,
    name: cm.full_name,
    role: cm.role,
    market: cm.market,
  });
}
