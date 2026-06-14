import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Service-role Supabase client for trusted server routes and functions. */
export async function getAdmin() {
  return supabaseAdmin;
}
