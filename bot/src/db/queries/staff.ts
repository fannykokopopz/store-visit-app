import { supabase } from '../client.js';

export interface Staff {
  id: string;
  name: string;
  phone: string | null;
  staff_type: 'staff' | 'other_brand' | 'part_timer';
  notes: string | null;
}

export interface TrainingModule {
  id: string;
  name: string;
  brand: string;
}

export async function getStaffForStore(storeId: string): Promise<Staff[]> {
  const { data, error } = await supabase
    .from('staff_store_assignments')
    .select('staff_id, staff(*)')
    .eq('store_id', storeId)
    .is('ended_at', null);

  if (error || !data) return [];
  return data.map((row: any) => row.staff as Staff).sort((a: Staff, b: Staff) => a.name.localeCompare(b.name));
}

export async function getActiveTrainingModules(): Promise<TrainingModule[]> {
  const { data, error } = await supabase
    .from('training_modules')
    .select('id, name, brand')
    .eq('is_active', true)
    .order('sort_order');

  if (error || !data) return [];
  return data as TrainingModule[];
}

export async function addStaffToStore(
  name: string,
  storeId: string,
  staffType: 'staff' | 'other_brand' | 'part_timer' = 'staff',
): Promise<Staff | null> {
  const { data: staff, error: staffErr } = await supabase
    .from('staff')
    .insert({ name, staff_type: staffType })
    .select()
    .single();

  if (staffErr || !staff) return null;

  const { error: assignErr } = await supabase
    .from('staff_store_assignments')
    .insert({ staff_id: staff.id, store_id: storeId });

  if (assignErr) return null;
  return staff as Staff;
}

export async function logTraining(
  visitId: string,
  staffId: string,
  moduleId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('visit_training_logs')
    .insert({ visit_id: visitId, staff_id: staffId, module_id: moduleId })
    .select()
    .single();

  if (error) {
    console.error('logTraining error:', error);
    return false;
  }
  return true;
}

export async function logAlly(
  visitId: string,
  staffId: string,
  cmId: string,
): Promise<boolean> {
  const quarter = getCurrentQuarter();

  const { error: allyErr } = await supabase
    .from('ally_qualifications')
    .upsert(
      { staff_id: staffId, quarter, qualified_by_cm_id: cmId },
      { onConflict: 'staff_id,quarter' },
    );

  if (allyErr) {
    console.error('logAlly qualification error:', allyErr);
    return false;
  }

  const { error: logErr } = await supabase
    .from('visit_ally_logs')
    .upsert(
      { visit_id: visitId, staff_id: staffId, quarter },
      { onConflict: 'visit_id,staff_id' },
    );

  if (logErr) {
    console.error('logAlly visit log error:', logErr);
    return false;
  }

  return true;
}

function getCurrentQuarter(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}
