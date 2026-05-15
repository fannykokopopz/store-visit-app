import { authedCMFromRequest } from "@/lib/miniapp-auth";
import { getFullVisitForCM, signPhotoUrls, updateVisitText } from "@/lib/queries";

const TEXT_FIELDS = ["good_news", "competitors", "display_stock", "follow_up", "buzz_plan"] as const;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const cm = await authedCMFromRequest(req);
  if (!cm) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }
  const { id } = await params;
  const visit = await getFullVisitForCM(cm.telegram_id, id, cm.role);
  if (!visit) {
    return Response.json({ error: "Visit not found" }, { status: 404 });
  }
  const photoUrls = await signPhotoUrls(visit.photo_paths);
  const canEditCoCMs = visit.viewer_is_lead || cm.role !== "cm";
  const canEditTraining = visit.viewer_is_lead || cm.role !== "cm";
  return Response.json({ visit, photoUrls, canEditCoCMs, canEditTraining });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const cm = await authedCMFromRequest(req);
  if (!cm) return Response.json({ error: "Not authorised" }, { status: 401 });

  const { id } = await params;
  const visit = await getFullVisitForCM(cm.telegram_id, id, cm.role);
  if (!visit) return Response.json({ error: "Visit not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const fields: Record<string, string | null> = {};
  for (const key of TEXT_FIELDS) {
    if (key in body) {
      const val = body[key];
      fields[key] = typeof val === "string" && val.trim() ? val.trim() : null;
    }
  }

  const ok = await updateVisitText(cm.telegram_id, id, fields);
  if (!ok) return Response.json({ error: "Update failed" }, { status: 500 });
  return Response.json({ ok: true });
}
