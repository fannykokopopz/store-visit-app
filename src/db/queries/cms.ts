import { supabase } from '../client.js';

export interface CM {
  telegram_id: number;
  full_name: string;
  role: 'cm' | 'cmic' | 'am' | 'admin';
  market: 'SG' | 'TH' | 'MY' | 'HK';
  am_telegram_id: number | null;
  is_active: boolean;
}

export async function getCMByTelegramId(telegramId: number): Promise<CM | null> {
  const { data, error } = await supabase
    .from('cms')
    .select('*')
    .eq('telegram_id', telegramId)
    .eq('is_active', true)
    .single();

  if (error) console.log('[auth] supabase error:', JSON.stringify(error));
  if (!data) console.log('[auth] no CM for telegramId:', telegramId);
  if (error || !data) return null;
  return data as CM;
}

export async function getAllCMs(market?: string): Promise<CM[]> {
  let query = supabase.from('cms').select('*').eq('is_active', true).order('full_name');
  if (market) query = query.eq('market', market);
  const { data, error } = await query;
  if (error || !data) return [];
  return data as CM[];
}

export async function createCM(data: {
  telegram_id: number;
  full_name: string;
  role: CM['role'];
  market: CM['market'];
  am_telegram_id?: number;
}): Promise<CM | null> {
  const { data: row, error } = await supabase
    .from('cms')
    .upsert(data, { onConflict: 'telegram_id' })
    .select()
    .single();

  if (error) {
    console.error('createCM error:', error);
    return null;
  }
  return row as CM;
}

export async function deactivateCM(telegramId: number): Promise<boolean> {
  const { error } = await supabase
    .from('cms')
    .update({ is_active: false })
    .eq('telegram_id', telegramId);

  if (error) {
    console.error('deactivateCM error:', error);
    return false;
  }
  return true;
}

export async function assignStoreToCM(
  cmTelegramId: number,
  storeId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('cm_store_assignments')
    .upsert({ cm_telegram_id: cmTelegramId, store_id: storeId, is_active: true });

  if (error) {
    console.error('assignStoreToCM error:', error);
    return false;
  }
  return true;
}
