import { supabase } from '../client.js';

export interface VisitInsert {
  store_id: string;
  user_id: string;
  visit_date?: string;
  relationship_notes?: string | null;
  training_notes?: string | null;
  experience_notes?: string | null;
  creative_notes?: string | null;
  raw_notes_combined?: string | null;
}

export interface Visit {
  id: string;
  store_id: string;
  user_id: string;
  visit_date: string;
  relationship_notes: string | null;
  training_notes: string | null;
  experience_notes: string | null;
  creative_notes: string | null;
  raw_notes_combined: string | null;
  overall_health: string | null;
  momentum: string | null;
  key_insight: string | null;
  recommended_action: string | null;
  submitted_at: string;
  edited_at: string | null;
}

export async function createVisit(visit: VisitInsert): Promise<Visit | null> {
  const combined = [
    visit.relationship_notes ? `--- RELATIONSHIP ---\n${visit.relationship_notes}` : null,
    visit.training_notes ? `--- TRAINING ---\n${visit.training_notes}` : null,
    visit.experience_notes ? `--- EXPERIENCE ---\n${visit.experience_notes}` : null,
    visit.creative_notes ? `--- CREATIVE METHODS ---\n${visit.creative_notes}` : null,
  ].filter(Boolean).join('\n\n');

  const { data, error } = await supabase
    .from('visits')
    .insert({ ...visit, raw_notes_combined: combined || null })
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
  updates: Partial<Pick<VisitInsert, 'relationship_notes' | 'training_notes' | 'experience_notes' | 'creative_notes'>>,
  editedBy: string,
): Promise<Visit | null> {
  const { data: existing, error: fetchErr } = await supabase
    .from('visits')
    .select('relationship_notes, training_notes, experience_notes, creative_notes')
    .eq('id', visitId)
    .single();

  if (fetchErr || !existing) return null;

  const merged = { ...existing, ...updates };
  const combined = [
    merged.relationship_notes ? `--- RELATIONSHIP ---\n${merged.relationship_notes}` : null,
    merged.training_notes ? `--- TRAINING ---\n${merged.training_notes}` : null,
    merged.experience_notes ? `--- EXPERIENCE ---\n${merged.experience_notes}` : null,
    merged.creative_notes ? `--- CREATIVE METHODS ---\n${merged.creative_notes}` : null,
  ].filter(Boolean).join('\n\n');

  const { data, error } = await supabase
    .from('visits')
    .update({
      ...updates,
      raw_notes_combined: combined || null,
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

export async function getRecentVisitsByUser(userId: string, limit = 5): Promise<(Visit & { stores: { name: string } })[]> {
  const { data, error } = await supabase
    .from('visits')
    .select('*, stores(name)')
    .eq('user_id', userId)
    .order('visit_date', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
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
