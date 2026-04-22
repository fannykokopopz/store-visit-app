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

export async function getAllStaffForStore(storeId: string): Promise<(Staff & { still_working: boolean })[]> {
  const { data, error } = await supabase
    .from('staff_store_assignments')
    .select('staff_id, ended_at, staff(*)')
    .eq('store_id', storeId);

  if (error || !data) return [];
  return data
    .map((row: any) => ({ ...row.staff, still_working: !row.ended_at } as Staff & { still_working: boolean }))
    .sort((a, b) => {
      if (a.still_working !== b.still_working) return a.still_working ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export async function updateStaffName(staffId: string, name: string): Promise<boolean> {
  const { error } = await supabase
    .from('staff')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', staffId);
  return !error;
}

export async function updateStaffType(staffId: string, staffType: Staff['staff_type']): Promise<boolean> {
  const { error } = await supabase
    .from('staff')
    .update({ staff_type: staffType, updated_at: new Date().toISOString() })
    .eq('id', staffId);
  return !error;
}

export async function setStaffActiveAtStore(staffId: string, storeId: string, active: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('staff_store_assignments')
    .update({ ended_at: active ? null : new Date().toISOString() })
    .eq('staff_id', staffId)
    .eq('store_id', storeId);
  return !error;
}

export interface StaffWithStore extends Staff {
  store_id: string;
  store_name: string;
  still_working: boolean;
}

export async function getAllStaffForUser(userId: string): Promise<StaffWithStore[]> {
  const { data, error } = await supabase
    .from('cm_store_assignments')
    .select('store_id, stores(name)')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error || !data) return [];

  const storeIds = data.map((r: any) => r.store_id);
  const storeNames = new Map(data.map((r: any) => [r.store_id, r.stores?.name || 'Unknown']));

  const { data: assignments, error: assErr } = await supabase
    .from('staff_store_assignments')
    .select('staff_id, store_id, ended_at, staff(*)')
    .in('store_id', storeIds);

  if (assErr || !assignments) return [];

  return assignments
    .map((row: any) => ({
      ...row.staff,
      store_id: row.store_id,
      store_name: storeNames.get(row.store_id) || 'Unknown',
      still_working: !row.ended_at,
    } as StaffWithStore))
    .sort((a, b) => {
      if (a.still_working !== b.still_working) return a.still_working ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export interface StaffStats {
  trainingsCompleted: number;
  lastTrainingDate: string | null;
  modulesTrainedOn: string[];
  assignmentHistory: { store_name: string; started_at: string; ended_at: string | null }[];
}

export async function getStaffStats(staffId: string): Promise<StaffStats> {
  const [trainingRes, assignmentRes] = await Promise.all([
    supabase
      .from('visit_training_logs')
      .select('created_at, training_modules(name)')
      .eq('staff_id', staffId)
      .order('created_at', { ascending: false }),
    supabase
      .from('staff_store_assignments')
      .select('store_id, started_at, ended_at, stores(name)')
      .eq('staff_id', staffId)
      .order('started_at', { ascending: false }),
  ]);

  const trainings = trainingRes.data || [];
  const moduleSet = new Set<string>();
  for (const t of trainings) {
    const name = (t as any).training_modules?.name;
    if (name) moduleSet.add(name);
  }

  const assignments = (assignmentRes.data || []).map((a: any) => ({
    store_name: a.stores?.name || 'Unknown',
    started_at: a.started_at,
    ended_at: a.ended_at,
  }));

  return {
    trainingsCompleted: trainings.length,
    lastTrainingDate: trainings.length > 0 ? trainings[0].created_at : null,
    modulesTrainedOn: Array.from(moduleSet),
    assignmentHistory: assignments,
  };
}

export async function transferStaff(staffId: string, fromStoreId: string, toStoreId: string): Promise<boolean> {
  const { error: endErr } = await supabase
    .from('staff_store_assignments')
    .update({ ended_at: new Date().toISOString() })
    .eq('staff_id', staffId)
    .eq('store_id', fromStoreId)
    .is('ended_at', null);

  if (endErr) return false;

  const { error: startErr } = await supabase
    .from('staff_store_assignments')
    .insert({ staff_id: staffId, store_id: toStoreId });

  return !startErr;
}
