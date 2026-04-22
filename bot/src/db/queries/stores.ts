import { supabase } from '../client.js';

export interface Store {
  id: string;
  name: string;
  chain: string;
  market: 'SG' | 'MY' | 'TH' | 'HK';
  tier: 'T1' | 'T2' | 'T3' | 'T4';
  address: string | null;
  is_active: boolean;
}

export async function getStoresForUser(userId: string): Promise<Store[]> {
  const { data, error } = await supabase
    .from('cm_store_assignments')
    .select('store_id, stores(*)')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error || !data) return [];

  return data
    .map((row: any) => row.stores as Store)
    .filter((s: Store) => s.is_active)
    .sort((a: Store, b: Store) => a.name.localeCompare(b.name));
}

export async function getStoreById(storeId: string): Promise<Store | null> {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .single();

  if (error || !data) return null;
  return data as Store;
}

export async function getAllActiveStores(market: string): Promise<Store[]> {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('market', market)
    .eq('is_active', true)
    .order('name');

  if (error || !data) return [];
  return data as Store[];
}
