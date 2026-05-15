import { authedCMFromRequest } from "@/lib/miniapp-auth";
import { getFullVisitForCM, getStoreStaffForVisit } from "@/lib/queries";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const cm = await authedCMFromRequest(req);
  if (!cm) return Response.json({ error: "Not authorised" }, { status: 401 });

  const { id } = await params;
  // Same auth as the visit detail page — ensures the CM can see this visit.
  const visit = await getFullVisitForCM(cm.telegram_id, id, cm.role);
  if (!visit) return Response.json({ error: "Visit not found" }, { status: 404 });

  const isLead = visit.viewer_is_lead;
  const isElevated = cm.role !== "cm";
  if (!isLead && !isElevated) {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }

  const staff = await getStoreStaffForVisit(id);
  if (!staff) return Response.json({ error: "Failed to load staff" }, { status: 500 });

  return Response.json({ staff });
}
