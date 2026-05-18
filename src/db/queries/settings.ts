import { supabase } from '../client.js';

export async function getSetting(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) {
    console.error('[settings] getSetting failed:', error);
    return null;
  }
  return data?.value ?? null;
}

export async function setSetting(
  key: string,
  value: string,
  updatedByTelegramId: number,
): Promise<boolean> {
  const { error } = await supabase
    .from('settings')
    .upsert(
      { key, value, updated_at: new Date().toISOString(), updated_by_telegram_id: updatedByTelegramId },
      { onConflict: 'key' },
    );
  if (error) {
    console.error('[settings] setSetting failed:', error);
    return false;
  }
  return true;
}
