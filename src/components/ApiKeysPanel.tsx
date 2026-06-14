import { useEffect, useState } from "react";
import { Copy, Key, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createMyApiKey, listMyApiKeys, revokeMyApiKey } from "@/lib/api-keys.functions";

type KeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
};

export function ApiKeysPanel() {
  const [items, setItems] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    listMyApiKeys()
      .then((r) => setItems(r.items as KeyRow[]))
      .catch((e) => toast.error(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      const r = await createMyApiKey({ data: { name: "API Key" } });
      setFreshKey(r.key);
      toast.success("已创建 API Key（仅显示一次，请复制保存）");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "创建失败");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    setBusy(true);
    try {
      await revokeMyApiKey({ data: { id } });
      toast.success("已撤销");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "撤销失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Key className="h-5 w-5 text-brand" />
        <h2 className="text-lg font-semibold">API Keys</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        用于调用 <code className="text-xs">POST /api/v1/generate</code>，Header: <code className="text-xs">X-API-Key</code>
      </p>

      {freshKey && (
        <div className="mb-4 rounded-xl border border-brand/30 bg-brand/5 p-3 flex items-center gap-2">
          <code className="text-xs flex-1 break-all">{freshKey}</code>
          <button
            type="button"
            className="shrink-0 rounded-lg btn-brand p-2"
            onClick={() => {
              void navigator.clipboard.writeText(freshKey);
              toast.success("已复制");
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={create}
        className="rounded-full btn-brand px-4 py-2 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        新建 Key
      </button>

      <div className="mt-4 space-y-2">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto my-6" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无 API Key</p>
        ) : (
          items.map((k) => (
            <div key={k.id} className="flex items-center gap-3 rounded-xl bg-muted/30 px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{k.name}</div>
                <div className="text-xs text-muted-foreground font-mono">{k.key_prefix}…</div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => revoke(k.id)}
                className="text-muted-foreground hover:text-destructive p-1"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
