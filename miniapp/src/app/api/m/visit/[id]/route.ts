import { authedCMFromRequest } from "@/lib/miniapp-auth";
import { getFullVisitForCM, signPhotoUrls } from "@/lib/queries";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const cm = await authedCMFromRequest(req);
  if (!cm) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }
  const { id } = await params;
  const visit = await getFullVisitForCM(cm.telegram_id, id);
  if (!visit) {
    return Response.json({ error: "Visit not found" }, { status: 404 });
  }
  const photoUrls = await signPhotoUrls(visit.photo_paths);
  return Response.json({ visit, photoUrls });
}
