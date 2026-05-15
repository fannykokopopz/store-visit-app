import { authedCMFromRequest } from "@/lib/miniapp-auth";
import { searchVisitsInMarket, VisitSectionKey } from "@/lib/queries";

const SECTION_KEYS: VisitSectionKey[] = [
  "good_news", "competitors", "display_stock", "follow_up", "buzz_plan",
];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const cm = await authedCMFromRequest(req);
  if (!cm) return Response.json({ error: "Not authorised" }, { status: 401 });

  const url = new URL(req.url);
  const sp = url.searchParams;

  const q = sp.get("q")?.trim() ?? "";

  // Section "has" filters — repeated `section=` params OR comma-separated
  const sectionsRaw = [...sp.getAll("section"), ...(sp.get("sections")?.split(",") ?? [])];
  const sections = Array.from(new Set(sectionsRaw))
    .filter((s): s is VisitSectionKey => SECTION_KEYS.includes(s as VisitSectionKey));

  const fromDate = sp.get("from")?.trim();
  const toDate = sp.get("to")?.trim();
  if (fromDate && !ISO_DATE.test(fromDate)) return Response.json({ error: "Bad from date" }, { status: 400 });
  if (toDate && !ISO_DATE.test(toDate)) return Response.json({ error: "Bad to date" }, { status: 400 });

  const storeId = sp.get("store_id")?.trim();
  if (storeId && !UUID.test(storeId)) return Response.json({ error: "Bad store_id" }, { status: 400 });

  let cmTelegramId: number | undefined;
  const cmIdRaw = sp.get("cm_telegram_id")?.trim();
  if (cmIdRaw) {
    const parsed = Number(cmIdRaw);
    if (!Number.isFinite(parsed)) return Response.json({ error: "Bad cm_telegram_id" }, { status: 400 });
    // CMs can only filter to themselves; cmic/am/admin can target any CM in their market
    cmTelegramId = cm.role === "cm" ? cm.telegram_id : parsed;
  } else if (cm.role === "cm") {
    cmTelegramId = cm.telegram_id;
  }

  const anyFilter =
    sections.length > 0 || !!fromDate || !!toDate || !!storeId || cmTelegramId !== undefined;
  const hasQuery = q.length >= 2;

  // No filters and no query → empty result (keeps original UX)
  if (!hasQuery && !anyFilter) return Response.json({ results: [] });

  const results = await searchVisitsInMarket(cm.market, {
    q,
    sections,
    fromDate,
    toDate,
    storeId,
    cmTelegramId,
  });

  return Response.json({ results });
}
