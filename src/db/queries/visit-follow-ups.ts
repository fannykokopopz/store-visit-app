import { supabase } from '../client.js';

export type FollowUpStatus = 'open' | 'done' | 'cancelled';

export interface VisitFollowUp {
  id: string;
  visit_id: string;
  store_id: string;
  cm_telegram_id: number;
  title: string;
  notes: string | null;
  due_date: string | null;
  status: FollowUpStatus;
  closed_at: string | null;
  closed_by_visit_id: string | null;
  created_at: string;
}

export async function createFollowUp(input: {
  visit_id: string;
  store_id: string;
  cm_telegram_id: number;
  title: string;
  notes?: string | null;
  due_date?: string | null;
}): Promise<VisitFollowUp | null> {
  const { data, error } = await supabase
    .from('visit_follow_ups')
    .insert({
      visit_id: input.visit_id,
      store_id: input.store_id,
      cm_telegram_id: input.cm_telegram_id,
      title: input.title,
      notes: input.notes ?? null,
      due_date: input.due_date ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('createFollowUp error:', error);
    return null;
  }
  return data as VisitFollowUp;
}

export async function listFollowUpsForVisit(visitId: string): Promise<VisitFollowUp[]> {
  const { data, error } = await supabase
    .from('visit_follow_ups')
    .select('*')
    .eq('visit_id', visitId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data as VisitFollowUp[];
}

export async function listOpenFollowUpsForStore(storeId: string): Promise<VisitFollowUp[]> {
  const { data, error } = await supabase
    .from('visit_follow_ups')
    .select('*')
    .eq('store_id', storeId)
    .eq('status', 'open')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data as VisitFollowUp[];
}

export async function markFollowUpDone(
  id: string,
  closedByVisitId: string | null = null,
): Promise<boolean> {
  const { error } = await supabase
    .from('visit_follow_ups')
    .update({
      status: 'done',
      closed_at: new Date().toISOString(),
      closed_by_visit_id: closedByVisitId,
    })
    .eq('id', id);
  if (error) {
    console.error('markFollowUpDone error:', error);
    return false;
  }
  return true;
}
