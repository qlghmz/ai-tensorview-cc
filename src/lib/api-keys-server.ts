import { randomBytes, createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateApiKeyPlain(): { plain: string; prefix: string; hash: string } {
  const body = randomBytes(24).toString("hex");
  const plain = `tv_${body}`;
  return { plain, prefix: plain.slice(0, 11), hash: hashApiKey(plain) };
}

export async function resolveUserIdFromApiKey(
  supabaseAdmin: SupabaseClient<Database>,
  apiKey: string,
): Promise<string | null> {
  const hash = hashApiKey(apiKey.trim());
  const { data } = await supabaseAdmin
    .from("api_keys")
    .select("user_id, id")
    .eq("key_hash", hash)
    .maybeSingle();
  if (!data) return null;
  void supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  return data.user_id;
}
