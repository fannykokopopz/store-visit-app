// Phase 3 stub — populated by nightly AI analysis cron

export interface Insight {
  id: string;
  visit_id: string;
  store_id: string;
  kind: 'competitor' | 'store' | 'relationship' | 'sales_opportunity';
  summary: string;
  detail: string | null;
  entities: Record<string, unknown> | null;
  confidence: number | null;
  source: 'notes' | 'photo' | 'both' | null;
  extracted_at: string;
  model: string | null;
}
