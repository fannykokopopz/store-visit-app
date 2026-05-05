import { supabase } from '../client.js';
import { ParsedSections } from '../../utils/parse-template.js';

export interface Visit {
  id: string;
  store_id: string;
  cm_telegram_id: number;
  visit_date: string;
  good_news: string | null;
  competitors: string | null;
  display_stock: string | null;
  follow_up: string | null;
  buzz_plan: string | null;
  is_locked: boolean;
  locked_at: string | null;
  submitted_at: string | null;
  edited_at: string | null;
  created_at: string;
}

export async function createVisit(data: {
  store_id: string;
  cm_telegram_id: number;
}): Promise<Visit | null> {
  const { data: row, error } = await supabase
    .from('visits')
    .insert(data)
    .select()
    .single();

  if (error) {
    console.error('createVisit error:', error);
    return null;
  }
  return row as Visit;
}

export async function attachVisitSections(
  visitId: string,
  sections: ParsedSections,
): Promise<boolean> {
  const { error } = await supabase
    .from('visits')
    .update({
      good_news: sections.goodNews,
      competitors: sections.competitors,
      display_stock: sections.displayStock,
      follow_up: sections.followUp,
      buzz_plan: sections.buzzPlan,
    })
    .eq('id', visitId);

  if (error) {
    console.error('attachVisitSections error:', error);
    return false;
  }
  return true;
}

export async function lockVisit(visitId: string): Promise<boolean> {
  const { error } = await supabase
    .from('visits')
    .update({
      is_locked: true,
      locked_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
    })
    .eq('id', visitId);

  if (error) {
    console.error('lockVisit error:', error);
    return false;
  }
  return true;
}

export async function getRecentVisitsByCM(
  telegramId: number,
  limit = 5,
): Promise<(Visit & { stores: { name: string } })[]> {
  const { data, error } = await supabase
    .from('visits')
    .select('*, stores(name)')
    .eq('cm_telegram_id', telegramId)
    .eq('is_locked', true)
    .order('visit_date', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as any;
}

export async function getLastVisitDatePerStore(
  telegramId: number,
): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('visits')
    .select('store_id, visit_date')
    .eq('cm_telegram_id', telegramId)
    .eq('is_locked', true)
    .order('visit_date', { ascending: false });

  if (error || !data) return {};

  const result: Record<string, string> = {};
  for (const row of data) {
    if (!result[row.store_id]) result[row.store_id] = row.visit_date;
  }
  return result;
}
