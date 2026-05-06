import { authedCMFromRequest } from "@/lib/miniapp-auth";
import { getStoreTimelineForCM } from "@/lib/queries";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const cm = await authedCMFromRequest(req);
  if (!cm) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }
  const { id } = await params;
  const result = await getStoreTimelineForCM(cm.telegram_id, id);
  if (!result.store) {
    return Response.json({ error: "Store not found" }, { status: 404 });
  }
  return Response.json(result);
}
