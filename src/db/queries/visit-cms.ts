import { supabase } from '../client.js';

export interface VisitCMRow {
  visit_id: string;
  cm_telegram_id: number;
  role: 'lead' | 'co';
  created_at: string;
}

export interface VisitCMWithName extends VisitCMRow {
  full_name: string;
  nickname: string | null;
}

export async function setVisitCMs(
  visitId: string,
  leadTelegramId: number,
  coTelegramIds: number[],
): Promise<boolean> {
  // Idempotent: clear all rows for this visit, then insert lead + co
  await supabase.from('visit_cms').delete().eq('visit_id', visitId);

  const rows = [
    { visit_id: visitId, cm_telegram_id: leadTelegramId, role: 'lead' as const },
    ...coTelegramIds
      .filter((id) => id !== leadTelegramId)
      .map((id) => ({ visit_id: visitId, cm_telegram_id: id, role: 'co' as const })),
  ];

  const { error } = await supabase.from('visit_cms').insert(rows);
  if (error) {
    console.error('setVisitCMs error:', error);
    return false;
  }
  return true;
}

export async function getVisitCMs(visitId: string): Promise<VisitCMWithName[]> {
  const { data, error } = await supabase
    .from('visit_cms')
    .select('visit_id, cm_telegram_id, role, created_at, cms(full_name, nickname)')
    .eq('visit_id', visitId)
    .order('role', { ascending: true }) // 'co' < 'lead' alphabetically — fix in mapper
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  return (data as any[])
    .map((r) => ({
      visit_id: r.visit_id,
      cm_telegram_id: r.cm_telegram_id,
      role: r.role,
      created_at: r.created_at,
      full_name: r.cms?.full_name ?? 'Unknown',
      nickname: r.cms?.nickname ?? null,
    }))
    .sort((a, b) => (a.role === 'lead' ? -1 : b.role === 'lead' ? 1 : 0));
}

export async function updateCoCMs(
  visitId: string,
  coTelegramIds: number[],
): Promise<boolean> {
  // Replace all 'co' rows for this visit; never touch the 'lead' row.
  const { data: leadRow } = await supabase
    .from('visit_cms')
    .select('cm_telegram_id')
    .eq('visit_id', visitId)
    .eq('role', 'lead')
    .maybeSingle();

  const leadId = (leadRow as any)?.cm_telegram_id as number | undefined;

  await supabase
    .from('visit_cms')
    .delete()
    .eq('visit_id', visitId)
    .eq('role', 'co');

  const filtered = coTelegramIds.filter((id) => id !== leadId);
  if (filtered.length === 0) return true;

  const { error } = await supabase
    .from('visit_cms')
    .insert(
      filtered.map((id) => ({ visit_id: visitId, cm_telegram_id: id, role: 'co' as const })),
    );

  if (error) {
    console.error('updateCoCMs error:', error);
    return false;
  }
  return true;
}
