import { NextRequest } from "next/server";
import { requireDashboardRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  if (!requireDashboardRole(req)) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("v_intelligence_reports_current")
    .select("id, report_date, version, edited_by_human, model, prompt_tokens, completion_tokens, stats, created_at")
    .order("report_date", { ascending: false })
    .limit(60);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ reports: data ?? [] });
}
