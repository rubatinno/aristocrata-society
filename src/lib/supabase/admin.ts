import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";
import { supabaseUrl } from "@/lib/supabase/env";

/**
 * Cliente com a service_role key. Ignora Row Level Security — use apenas em
 * Server Actions/Route Handlers confiáveis (ex: criar um agendamento após
 * validar que o horário ainda está livre).
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
