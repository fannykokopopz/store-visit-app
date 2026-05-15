import { authedCMFromRequest } from "@/lib/miniapp-auth";
import { getFullVisitForCM, updateVisitStaffProducts } from "@/lib/queries";

interface UpdatePayload {
  updates: Array<{ staff_id: string; products: string | null }>;
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

  const isLead = visit.viewer_is_lead;
  const isElevated = cm.role !== "cm";
  if (!isLead && !isElevated) {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as UpdatePayload | null;
  if (!body || !Array.isArray(body.updates)) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const validIds = new Set(visit.trained_staff.map((s) => s.staff_id));
  const clean = body.updates
    .filter((u) => u && typeof u.staff_id === "string" && validIds.has(u.staff_id))
    .map((u) => ({
      staff_id: u.staff_id,
      products: typeof u.products === "string" ? u.products : null,
    }));

  if (clean.length === 0) {
    return Response.json({ error: "No valid updates" }, { status: 400 });
  }

  const ok = await updateVisitStaffProducts(id, clean);
  if (!ok) return Response.json({ error: "Update failed" }, { status: 500 });
  return Response.json({ ok: true });
}
