import { createClient } from "@supabase/supabase-js";

function buildClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "sva" },
  });
}

type SvaClient = ReturnType<typeof buildClient>;
let _client: SvaClient | null = null;
function getClient(): SvaClient {
  if (!_client) _client = buildClient();
  return _client;
}

export const supabase: SvaClient = new Proxy({} as SvaClient, {
  get(_target, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getClient() as any)[prop];
  },
}) as SvaClient;
