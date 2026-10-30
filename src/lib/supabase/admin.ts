import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseServiceKey, supabaseUrl } from "@/lib/env";

/**
 * Client con chiave service_role / secret: bypassa RLS.
 * Usarlo SOLO in server action già protette da requireAdmin().
 */
export function createAdminClient() {
  const key = supabaseServiceKey();
  if (!key) {
    throw new Error("Manca la variabile SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY)");
  }
  return createClient(supabaseUrl()!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
