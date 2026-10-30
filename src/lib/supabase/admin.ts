import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client con chiave service_role: bypassa RLS.
 * Usarlo SOLO in server action già protette da requireAdmin().
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("Manca la variabile SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
