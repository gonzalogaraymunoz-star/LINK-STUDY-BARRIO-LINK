import { createClient } from "@supabase/supabase-js";

const CENTRAL_SUPABASE_URL = "https://zgbnjlrxzvzpigmwidsp.supabase.co";

export function getCentralSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || CENTRAL_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRole) return null;
  return createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
