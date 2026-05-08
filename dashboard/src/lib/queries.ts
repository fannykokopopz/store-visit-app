import { supabase } from "./supabase";

export interface VisitRow {
  id: string;
  visit_date: string;
  cm_telegram_id: number;
  cm_name: string;
  store_id: string;
  store_name: string;
  store_chain: string;
  store_tier: "T1" | "T2" | "T3" | "T4" | null;
  good_news: string | null;
  competitors: string | null;
  display_stock: string | null;
  follow_up: string | null;
  buzz_plan: string | null;
  training: string | null;
  photo_count: number;
  sections_filled: number;
  edited_at: string | null;
}

export interface StaffRow {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  is_ally: boolean;
  ally_since: string | null;
  store_id: string;
  store_name: string;
  store_chain: string;
  store_tier: "T1" | "T2" | "T3" | "T4" | null;
}

export interface CMOption { telegram_id: number; name: string }
export interface StoreOption { id: string; name: string; chain: string; tier: string | null }

export interface TeamStats {
  visits_this_month: number;
  visits_all_time: number;
  active_cms_this_month: number;
  total_cms: number;
  total_stores: number;
}

const SECTION_KEYS = ["good_news", "competitors", "display_stock", "follow_up", "buzz_plan", "training"] as const;

function countSections(row: Record<string, unknown>): number {
  return SECTION_KEYS.filter((k) => row[k]).length;
}

export async function getTeamStats(): Promise<TeamStats> {
  const monthStart = new Date();
  monthStart.setDate(1);
  const since = monthStart.toISOString().slice(0, 10);

  const [allTime, thisMonth, cms, stores] = await Promise.all([
    supabase.from("visits").select("id", { count: "exact", head: true }).eq("is_locked", true),
    supabase.from("visits").select("cm_telegram_id").eq("is_locked", true).gte("visit_date", since),
    supabase.from("cms").select("telegram_id", { count: "exact", head: true }),
    supabase.from("stores").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  const activeCmIds = new Set((thisMonth.data ?? []).map((r: { cm_telegram_id: number }) => r.cm_telegram_id));

  return {
    visits_all_time: allTime.count ?? 0,
    visits_this_month: thisMonth.data?.length ?? 0,
    active_cms_this_month: activeCmIds.size,
    total_cms: cms.count ?? 0,
    total_stores: stores.count ?? 0,
  };
}

export interface StoreStatus {
  id: string;
  name: string;
  chain: string;
  market: 'SG' | 'TH' | 'MY' | 'HK';
  tier: 'T1' | 'T2' | 'T3' | 'T4' | null;
  last_visit_date: string | null;
}

export async function getStoreStatus(): Promise<StoreStatus[]> {
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name, chain, market, tier')
    .eq('is_active', true)
    .order('market')
    .order('chain')
    .order('name');

  if (!stores || stores.length === 0) return [];

  const storeIds = stores.map((s) => s.id);

  const { data: visits } = await supabase
    .from('visits')
    .select('store_id, visit_date')
    .in('store_id', storeIds)
    .eq('is_locked', true)
    .order('visit_date', { ascending: false });

  const lastVisit = new Map<string, string>();
  for (const v of visits ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = v as any;
    if (!lastVisit.has(row.store_id)) lastVisit.set(row.store_id, row.visit_date);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return stores.map((s: any) => ({
    id: s.id,
    name: s.name,
    chain: s.chain,
    market: s.market,
    tier: s.tier,
    last_visit_date: lastVisit.get(s.id) ?? null,
  }));
}

export async function getVisitsFeed(opts: {
  cm?: number;
  store?: string;
  from?: string;
  to?: string;
  offset?: number;
  limit?: number;
  market?: string;
}): Promise<{ visits: VisitRow[]; total: number }> {
  const limit = opts.limit ?? 25;
  const offset = opts.offset ?? 0;

  let q = supabase
    .from("visits")
    .select("*, stores(name, chain, tier), cms(full_name)", { count: "exact" })
    .eq("is_locked", true)
    .order("visit_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.cm) q = q.eq("cm_telegram_id", opts.cm);
  if (opts.store) q = q.eq("store_id", opts.store);
  if (opts.from) q = q.gte("visit_date", opts.from);
  if (opts.to) q = q.lte("visit_date", opts.to);
  if (opts.market) {
    const { data: mStores } = await supabase
      .from("stores")
      .select("id")
      .eq("market", opts.market)
      .eq("is_active", true);
    const ids = (mStores ?? []).map((s: { id: string }) => s.id);
    if (ids.length === 0) return { visits: [], total: 0 };
    q = q.in("store_id", ids);
  }

  const { data, count } = await q;

  const visits: VisitRow[] = (data ?? []).map((v) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = v as any;
    return {
      id: row.id,
      visit_date: row.visit_date,
      cm_telegram_id: row.cm_telegram_id,
      cm_name: row.cms?.full_name ?? "Unknown",
      store_id: row.store_id,
      store_name: row.stores?.name ?? "Unknown",
      store_chain: row.stores?.chain ?? "",
      store_tier: row.stores?.tier ?? null,
      good_news: row.good_news,
      competitors: row.competitors,
      display_stock: row.display_stock,
      follow_up: row.follow_up,
      buzz_plan: row.buzz_plan,
      training: row.training,
      photo_count: 0,
      sections_filled: countSections(row),
      edited_at: row.edited_at,
    };
  });

  // Attach photo counts in one query
  if (visits.length > 0) {
    const ids = visits.map((v) => v.id);
    const { data: photos } = await supabase
      .from("visit_photos")
      .select("visit_id")
      .in("visit_id", ids);
    const photoCount = new Map<string, number>();
    for (const p of photos ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = p as any;
      photoCount.set(row.visit_id, (photoCount.get(row.visit_id) ?? 0) + 1);
    }
    for (const v of visits) v.photo_count = photoCount.get(v.id) ?? 0;
  }

  return { visits, total: count ?? 0 };
}

export async function getCMsList(): Promise<CMOption[]> {
  const { data } = await supabase.from("cms").select("telegram_id, full_name").order("full_name");
  return (data ?? []).map((r: { telegram_id: number; full_name: string }) => ({ telegram_id: r.telegram_id, name: r.full_name }));
}

export async function getStoresList(): Promise<StoreOption[]> {
  const { data } = await supabase
    .from("stores")
    .select("id, name, chain, tier")
    .eq("is_active", true)
    .order("name");
  return (data ?? []) as StoreOption[];
}

export async function getAllStaff(): Promise<StaffRow[]> {
  const { data } = await supabase
    .from("staff")
    .select("*, stores(name, chain, tier)")
    .order("store_id")
    .order("name");

  return (data ?? []).map((s) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = s as any;
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      phone: row.phone,
      is_ally: row.is_ally,
      ally_since: row.ally_since,
      store_id: row.store_id,
      store_name: row.stores?.name ?? "Unknown",
      store_chain: row.stores?.chain ?? "",
      store_tier: row.stores?.tier ?? null,
    };
  });
}

export async function setAllyStatus(staffId: string, isAlly: boolean): Promise<boolean> {
  const { error } = await supabase
    .from("staff")
    .update({ is_ally: isAlly, ally_since: isAlly ? new Date().toISOString() : null })
    .eq("id", staffId);
  return !error;
}
