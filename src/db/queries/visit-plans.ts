import { supabase } from '../client.js';

export interface VisitPlan {
  id: string;
  cm_telegram_id: number;
  store_id: string;
  planned_date: string | null;
  buzz_plan: string | null;
  notes: string | null;
  consumed_at: string | null;
  created_at: string;
}

export async function getActivePlan(
  telegramId: number,
  storeId: string,
): Promise<VisitPlan | null> {
  const { data, error } = await supabase
    .from('visit_plans')
    .select('*')
    .eq('cm_telegram_id', telegramId)
    .eq('store_id', storeId)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as VisitPlan;
}

export async function consumePlan(planId: string): Promise<void> {
  const { error } = await supabase
    .from('visit_plans')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', planId);

  if (error) console.error('consumePlan error:', error);
}

export async function createPlan(data: {
  cm_telegram_id: number;
  store_id: string;
  planned_date?: string;
  buzz_plan?: string;
  notes?: string;
}): Promise<VisitPlan | null> {
  // Replace any existing active plan for this store
  await supabase
    .from('visit_plans')
    .update({ consumed_at: new Date().toISOString() })
    .eq('cm_telegram_id', data.cm_telegram_id)
    .eq('store_id', data.store_id)
    .is('consumed_at', null);

  const { data: row, error } = await supabase
    .from('visit_plans')
    .insert(data)
    .select()
    .single();

  if (error) {
    console.error('createPlan error:', error);
    return null;
  }
  return row as VisitPlan;
}
