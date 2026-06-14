import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdmin } from "@/integrations/supabase/admin.server";
import { generateApiKeyPlain } from "@/lib/api-keys-server";

export const listMyApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await getAdmin();
    const { data } = await supabaseAdmin
      .from("api_keys")
      .select("id, name, key_prefix, last_used_at, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    return { items: data ?? [] };
  });

export const createMyApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const o = d as { name?: string } | undefined;
    return { name: o?.name?.trim() || "Default" };
  })
  .handler(async ({ context, data }) => {
    const name = data.name;
    const supabaseAdmin = await getAdmin();
    const { plain, prefix, hash } = generateApiKeyPlain();
    const { error } = await supabaseAdmin.from("api_keys").insert({
      user_id: context.userId,
      name,
      key_prefix: prefix,
      key_hash: hash,
    });
    if (error) throw new Error(error.message);
    return { key: plain, prefix, name };
  });

export const revokeMyApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const id = (d as { id?: string } | undefined)?.id;
    if (!id) throw new Error("id required");
    return { id };
  })
  .handler(async ({ context, data }) => {
    const id = data.id;
    const supabaseAdmin = await getAdmin();
    const { error } = await supabaseAdmin.from("api_keys").delete().eq("id", id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
