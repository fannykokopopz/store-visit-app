import { supabase } from "./supabase";

export interface Store {
  id: string;
  name: string;
  chain: string;
  market: "SG" | "TH" | "MY" | "HK";
  tier: "T1" | "T2" | "T3" | "T4" | null;
  address: string | null;
}

export interface PortfolioStore extends Store {
  last_visit_date: string | null;
  last_visit_id: string | null;
  visits_30d: number;
}

export interface VisitSummary {
  id: string;
  visit_date: string;
  good_news: string | null;
  competitors: string | null;
  display_stock: string | null;
  follow_up: string | null;
  buzz_plan: string | null;
  photo_count: number;
}

export interface FullVisit extends VisitSummary {
  store_id: string;
  store_name: string;
  cm_telegram_id: number;
  is_locked: boolean;
  submitted_at: string | null;
  edited_at: string | null;
  photo_paths: string[];
}

export async function getPortfolioForCM(
  telegramId: number,
): Promise<PortfolioStore[]> {
  const { data: assignRows, error: assignErr } = await supabase
    .from("cm_store_assignments")
    .select("store_id, stores(*)")
    .eq("cm_telegram_id", telegramId)
    .eq("is_active", true);

  if (assignErr || !assignRows) return [];

  const stores: Store[] = assignRows
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((row: any) => row.stores as Store)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((s: any) => s && s.is_active !== false);

  if (stores.length === 0) return [];

  const storeIds = stores.map((s) => s.id);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: visitRows } = await supabase
    .from("visits")
    .select("id, store_id, visit_date")
    .eq("cm_telegram_id", telegramId)
    .eq("is_locked", true)
    .in("store_id", storeIds)
    .order("visit_date", { ascending: false });

  const lastVisitByStore = new Map<string, { id: string; date: string }>();
  const count30dByStore = new Map<string, number>();

  for (const v of visitRows ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = v as any;
    if (!lastVisitByStore.has(row.store_id)) {
      lastVisitByStore.set(row.store_id, { id: row.id, date: row.visit_date });
    }
    if (row.visit_date >= since) {
      count30dByStore.set(
        row.store_id,
        (count30dByStore.get(row.store_id) ?? 0) + 1,
      );
    }
  }

  return stores
    .map((s) => ({
      ...s,
      last_visit_date: lastVisitByStore.get(s.id)?.date ?? null,
      last_visit_id: lastVisitByStore.get(s.id)?.id ?? null,
      visits_30d: count30dByStore.get(s.id) ?? 0,
    }))
    .sort((a, b) => {
      // sort: visited stores first by recency, then unvisited alphabetically
      if (a.last_visit_date && b.last_visit_date) {
        return b.last_visit_date.localeCompare(a.last_visit_date);
      }
      if (a.last_visit_date) return -1;
      if (b.last_visit_date) return 1;
      return a.name.localeCompare(b.name);
    });
}

export async function getStoreTimelineForCM(
  telegramId: number,
  storeId: string,
): Promise<{ store: Store | null; visits: VisitSummary[] }> {
  const [storeRes, visitsRes] = await Promise.all([
    supabase.from("stores").select("*").eq("id", storeId).single(),
    supabase
      .from("visits")
      .select(
        "id, visit_date, good_news, competitors, display_stock, follow_up, buzz_plan",
      )
      .eq("cm_telegram_id", telegramId)
      .eq("store_id", storeId)
      .eq("is_locked", true)
      .order("visit_date", { ascending: false }),
  ]);

  const store = (storeRes.data as Store | null) ?? null;
  const visitRows = (visitsRes.data ?? []) as Omit<VisitSummary, "photo_count">[];

  if (visitRows.length === 0) return { store, visits: [] };

  const ids = visitRows.map((v) => v.id);
  const { data: photoRows } = await supabase
    .from("visit_photos")
    .select("visit_id")
    .in("visit_id", ids);

  const countByVisit = new Map<string, number>();
  for (const p of photoRows ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vid = (p as any).visit_id as string;
    countByVisit.set(vid, (countByVisit.get(vid) ?? 0) + 1);
  }

  const visits: VisitSummary[] = visitRows.map((v) => ({
    ...v,
    photo_count: countByVisit.get(v.id) ?? 0,
  }));

  return { store, visits };
}

export async function getFullVisitForCM(
  telegramId: number,
  visitId: string,
): Promise<FullVisit | null> {
  const { data, error } = await supabase
    .from("visits")
    .select("*, stores(name)")
    .eq("id", visitId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (error || !data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = data as any;
  if (v.cm_telegram_id !== telegramId) return null;

  const { data: photos } = await supabase
    .from("visit_photos")
    .select("storage_path")
    .eq("visit_id", visitId)
    .order("created_at");

  const photoPaths = (photos ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) => p.storage_path as string)
    .filter(Boolean);

  return {
    id: v.id,
    visit_date: v.visit_date,
    good_news: v.good_news,
    competitors: v.competitors,
    display_stock: v.display_stock,
    follow_up: v.follow_up,
    buzz_plan: v.buzz_plan,
    store_id: v.store_id,
    store_name: v.stores?.name ?? "Unknown store",
    cm_telegram_id: v.cm_telegram_id,
    is_locked: v.is_locked,
    submitted_at: v.submitted_at,
    edited_at: v.edited_at,
    photo_count: photoPaths.length,
    photo_paths: photoPaths,
  };
}

export async function signPhotoUrls(
  paths: string[],
  ttlSec = 300,
): Promise<string[]> {
  if (paths.length === 0) return [];
  const { data, error } = await supabase.storage
    .from("sva-photos")
    .createSignedUrls(paths, ttlSec);
  if (error || !data) return [];
  return data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((d: any) => d.signedUrl as string)
    .filter((u: string) => Boolean(u));
}
