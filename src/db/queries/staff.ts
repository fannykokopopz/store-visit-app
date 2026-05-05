import { supabase } from '../client.js';

export interface Staff {
  id: string;
  name: string;
  role: string | null;
  store_id: string | null;
  phone: string | null;
  is_ally: boolean;
  ally_since: string | null;
  created_at: string;
}

export async function getStaffForStore(storeId: string): Promise<Staff[]> {
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .eq('store_id', storeId)
    .order('name');

  if (error || !data) return [];
  return data as Staff[];
}

export async function createStaff(data: {
  name: string;
  role?: string;
  store_id: string;
}): Promise<Staff | null> {
  const { data: row, error } = await supabase
    .from('staff')
    .insert(data)
    .select()
    .single();

  if (error) {
    console.error('createStaff error:', error);
    return null;
  }
  return row as Staff;
}

export async function setAllyStatus(
  staffId: string,
  isAlly: boolean,
): Promise<boolean> {
  const { error } = await supabase
    .from('staff')
    .update({
      is_ally: isAlly,
      ally_since: isAlly ? new Date().toISOString() : null,
    })
    .eq('id', staffId);

  if (error) {
    console.error('setAllyStatus error:', error);
    return false;
  }
  return true;
}

export async function attachStaffToVisit(
  visitId: string,
  staffIds: string[],
): Promise<void> {
  if (staffIds.length === 0) return;

  const rows = staffIds.map(staff_id => ({ visit_id: visitId, staff_id }));
  const { error } = await supabase.from('visit_staff').insert(rows);
  if (error) console.error('attachStaffToVisit error:', error);
}
