import { NextRequest } from "next/server";
import { requireDashboardRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  if (!requireDashboardRole(req)) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }

  const scope = req.nextUrl.searchParams.get("scope"); // store | person | theme | channel | null

  let q = supabase
    .from("v_memory_notes_current")
    .select("slug, scope, scope_ref, title, summary, version, tier, last_touched_at, edited_by_human, related_slugs")
    .order("last_touched_at", { ascending: false });

  if (scope) q = q.eq("scope", scope);

  const { data, error } = await q;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ notes: data ?? [] });
}
