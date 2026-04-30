import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Lock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("密码至少 6 位");
    if (password !== confirm) return toast.error("两次密码不一致");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("密码已更新");
      navigate({ to: "/dashboard", search: {} });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen relative grid place-items-center px-4 overflow-hidden"
      style={{ background: "var(--gradient-hero)" }}
    >
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <Link to="/" className="absolute top-6 left-6 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg btn-brand">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="text-lg font-bold">特挠率i额外</span>
      </Link>

      <div className="relative w-full max-w-md glass rounded-3xl p-8 shadow-[var(--shadow-card)]">
        <h1 className="text-2xl font-bold">设置新密码</h1>
        <p className="mt-1 text-sm text-muted-foreground">为账户设置一个新的登录密码。</p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <Field>
            <Lock className="h-4 w-4 text-muted-foreground" />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="新密码"
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </Field>
          <Field>
            <Lock className="h-4 w-4 text-muted-foreground" />
            <input
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="确认新密码"
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </Field>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl btn-brand py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "更新密码"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-input border border-border px-3 py-2.5 focus-within:border-brand transition">
      {children}
    </div>
  );
}
