import { NextRequest } from "next/server";
import { requireDashboardRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

interface Params { params: Promise<{ date: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  if (!requireDashboardRole(req)) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }
  const { date } = await params;

  const { data, error } = await supabase
    .from("v_intelligence_reports_current")
    .select("*")
    .eq("report_date", date)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ report: data });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = requireDashboardRole(req);
  if (!session) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }
  const { date } = await params;
  const body = await req.json().catch(() => ({})) as { brief_markdown?: string };

  if (!body.brief_markdown || body.brief_markdown.trim().length < 50) {
    return Response.json({ error: "brief_markdown required" }, { status: 400 });
  }

  // Get existing report + max version
  const { data: existing, error: exErr } = await supabase
    .from("intelligence_reports")
    .select("version, stats, visit_ids, model, prompt_tokens, completion_tokens")
    .eq("report_date", date)
    .order("version", { ascending: false })
    .limit(1);

  if (exErr) {
    return Response.json({ error: exErr.message }, { status: 500 });
  }
  if (!existing || existing.length === 0) {
    return Response.json({ error: "No report to edit for this date" }, { status: 404 });
  }

  const prev = existing[0];
  const nextVersion = prev.version + 1;

  const { data: inserted, error } = await supabase
    .from("intelligence_reports")
    .insert({
      report_date: date,
      version: nextVersion,
      brief_markdown: body.brief_markdown,
      stats: prev.stats,
      visit_ids: prev.visit_ids,
      model: prev.model,
      prompt_tokens: prev.prompt_tokens,
      completion_tokens: prev.completion_tokens,
      edited_by_human: true,
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ report: inserted });
}
