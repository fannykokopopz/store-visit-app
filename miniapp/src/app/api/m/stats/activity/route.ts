import { authedCMFromRequest } from "@/lib/miniapp-auth";
import { getStatsActivityForCM } from "@/lib/queries";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const cm = await authedCMFromRequest(req);
  if (!cm) return Response.json({ error: "Not authorised" }, { status: 401 });

  const url = new URL(req.url);
  const fromDate = url.searchParams.get("from")?.trim() || undefined;
  const toDate = url.searchParams.get("to")?.trim() || undefined;
  if (fromDate && !ISO_DATE.test(fromDate)) return Response.json({ error: "Bad from date" }, { status: 400 });
  if (toDate && !ISO_DATE.test(toDate)) return Response.json({ error: "Bad to date" }, { status: 400 });

  let targetId = cm.telegram_id;
  const cmIdRaw = url.searchParams.get("cm_telegram_id")?.trim();
  if (cmIdRaw && cm.role !== "cm") {
    const parsed = Number(cmIdRaw);
    if (Number.isFinite(parsed)) targetId = parsed;
  }

  const activity = await getStatsActivityForCM(targetId, fromDate, toDate);
  return Response.json(activity);
}
