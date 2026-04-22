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
