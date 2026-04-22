import { supabase } from '../client.js';

export interface User {
  id: string;
  telegram_chat_id: number | null;
  full_name: string;
  email: string | null;
  role: 'cm' | 'manager' | 'admin';
  market: 'SG' | 'MY' | 'TH' | 'HK';
  am_telegram_chat_id: number | null;
  is_active: boolean;
}

export async function getUserByTelegramId(chatId: number): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_chat_id', chatId)
    .eq('is_active', true)
    .single();

  if (error) console.log('[auth] supabase error:', JSON.stringify(error));
  if (!data) console.log('[auth] no data returned for chatId:', chatId);
  if (error || !data) return null;
  return data as User;
}

export async function getManagersForMarket(market: string): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('market', market)
    .in('role', ['manager', 'admin'])
    .eq('is_active', true);

  if (error || !data) return [];
  return data as User[];
}
