import { supabase } from '../client.js';

export interface VisitInsert {
  store_id: string;
  user_id: string;
  visit_date?: string;
  visit_notes?: string | null;
}

export interface Visit {
  id: string;
  store_id: string;
  user_id: string;
  visit_date: string;
  visit_notes: string | null;
  raw_notes_combined: string | null;
  overall_health: string | null;
  momentum: string | null;
  key_insight: string | null;
  recommended_action: string | null;
  submitted_at: string;
  edited_at: string | null;
}

export async function createVisit(visit: VisitInsert): Promise<Visit | null> {
  const { data, error } = await supabase
    .from('visits')
    .insert({
      ...visit,
      raw_notes_combined: visit.visit_notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error('createVisit error:', error);
    return null;
  }
  return data as Visit;
}

export async function updateVisitNotes(
  visitId: string,
  notes: string,
  editedBy: string,
): Promise<Visit | null> {
  const { data, error } = await supabase
    .from('visits')
    .update({
      visit_notes: notes,
      raw_notes_combined: notes,
      edited_at: new Date().toISOString(),
      edited_by: editedBy,
    })
    .eq('id', visitId)
    .select()
    .single();

  if (error) {
    console.error('updateVisitNotes error:', error);
    return null;
  }
  return data as Visit;
}

export async function getRecentVisitsByUser(userId: string, limit = 10): Promise<(Visit & { stores: { name: string } })[]> {
  const { data, error } = await supabase
    .from('visits')
    .select('*, stores(name)')
    .eq('user_id', userId)
    .order('visit_date', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as any;
}

export async function getLastVisitForStore(storeId: string, userId: string): Promise<Visit | null> {
  const { data, error } = await supabase
    .from('visits')
    .select('*')
    .eq('store_id', storeId)
    .eq('user_id', userId)
    .order('visit_date', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as Visit;
}

export async function getVisitById(visitId: string): Promise<(Visit & { stores: { name: string } }) | null> {
  const { data, error } = await supabase
    .from('visits')
    .select('*, stores(name)')
    .eq('id', visitId)
    .single();

  if (error || !data) return null;
  return data as any;
}

export interface StoreVisitStats {
  daysSinceLastVisit: number | null;
  visitsThisMonth: number;
  staffCount: number;
  trainingsThisQuarter: number;
}

export async function getStoreVisitStats(storeId: string, userId: string): Promise<StoreVisitStats> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
  const quarterStart = new Date(now.getFullYear(), quarterMonth, 1).toISOString();

  const [lastVisitRes, monthCountRes, staffCountRes, trainingCountRes] = await Promise.all([
    supabase
      .from('visits')
      .select('visit_date')
      .eq('store_id', storeId)
      .eq('user_id', userId)
      .order('visit_date', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('visits')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('user_id', userId)
      .gte('visit_date', monthStart),
    supabase
      .from('staff_store_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .is('ended_at', null),
    supabase
      .from('visit_training_logs')
      .select('id, visits!inner(store_id)', { count: 'exact', head: true })
      .eq('visits.store_id', storeId)
      .gte('created_at', quarterStart),
  ]);

  let daysSinceLastVisit: number | null = null;
  if (lastVisitRes.data?.visit_date) {
    const last = new Date(lastVisitRes.data.visit_date);
    daysSinceLastVisit = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  }

  return {
    daysSinceLastVisit,
    visitsThisMonth: monthCountRes.count ?? 0,
    staffCount: staffCountRes.count ?? 0,
    trainingsThisQuarter: trainingCountRes.count ?? 0,
  };
}

export async function getLatestVisitPerStore(userId: string): Promise<(Visit & { stores: { name: string; chain: string } })[]> {
  const { data, error } = await supabase
    .from('visits')
    .select('*, stores(name, chain)')
    .eq('user_id', userId)
    .order('visit_date', { ascending: false });

  if (error || !data) return [];

  const seen = new Map<string, any>();
  for (const visit of data) {
    if (!seen.has(visit.store_id)) {
      seen.set(visit.store_id, visit);
    }
  }
  return Array.from(seen.values());
}
