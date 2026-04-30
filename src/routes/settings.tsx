import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, User, LogOut, Sparkles, Mail, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SiteHeader } from "@/components/site/SiteHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setDisplayName(data?.display_name ?? "");
        setAvatarUrl(data?.avatar_url ?? "");
        setLoaded(true);
      });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, display_name: displayName, avatar_url: avatarUrl || null });
    setSaving(false);
    if (error) return toast.error("保存失败");
    toast.success("已保存");
  };

  if (loading || !user || !loaded) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const initial = (displayName || user.email || "U").slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen relative" style={{ background: "var(--gradient-hero)" }}>
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="relative">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-6 py-12">
          <div className="flex items-center gap-3 mb-8">
            <span className="grid h-10 w-10 place-items-center rounded-xl btn-brand">
              <User className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold">账户设置</h1>
              <p className="text-sm text-muted-foreground">管理你的个人信息与登录方式</p>
            </div>
          </div>

          <section className="glass rounded-3xl p-6 space-y-5">
            <div className="flex items-center gap-4">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-16 w-16 rounded-2xl object-cover border border-border" />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-2xl text-2xl font-bold btn-brand">
                  {initial}
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{user.email ?? "未绑定邮箱"}</div>
                <div className="text-xs mt-1">用户 ID：{user.id.slice(0, 8)}…</div>
              </div>
            </div>

            <Field label="显示名称">
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="你想被怎么称呼？"
                className="flex-1 bg-transparent outline-none text-sm"
              />
            </Field>
            <Field label="头像 URL">
              <input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 bg-transparent outline-none text-sm"
              />
            </Field>

            <button
              onClick={save}
              disabled={saving}
              className="rounded-xl btn-brand px-5 py-2.5 text-sm font-semibold inline-flex items-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              保存修改
            </button>
          </section>

          <section className="glass rounded-3xl p-6 mt-5">
            <div className="font-semibold mb-1">安全</div>
            <p className="text-sm text-muted-foreground mb-4">修改密码将向你的邮箱发送重置链接。</p>
            <Link to="/forgot-password" className="rounded-xl glass px-4 py-2 text-sm hover:border-brand/40 transition inline-flex">
              修改密码
            </Link>
          </section>

          <section className="glass rounded-3xl p-6 mt-5 border-destructive/40">
            <div className="font-semibold mb-1">退出登录</div>
            <p className="text-sm text-muted-foreground mb-4">在这台设备上退出当前账户。</p>
            <button
              onClick={async () => {
                await signOut();
                navigate({ to: "/" });
              }}
              className="rounded-xl bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30 transition px-4 py-2 text-sm font-medium inline-flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" /> 退出
            </button>
          </section>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 inline mr-1" />
            想要更多功能？查看
            <Link to="/pricing" className="text-brand hover:underline ml-1">付费方案</Link>
          </p>
        </main>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-muted-foreground mb-1.5">{label}</div>
      <div className="flex items-center gap-3 rounded-xl bg-input border border-border px-3 py-2.5 focus-within:border-brand transition">
        {children}
      </div>
    </label>
  );
}
