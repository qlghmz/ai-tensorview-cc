import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type AuthedSupabaseContext = {
  supabase: ReturnType<typeof createClient<Database>>;
  userId: string;
};

export async function getAuthedSupabaseFromRequest(
  request: Request,
): Promise<AuthedSupabaseContext | Response> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return new Response("Supabase 未配置", { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return new Response("Unauthorized", { status: 401 });
  }

  return { supabase, userId: data.claims.sub };
}
