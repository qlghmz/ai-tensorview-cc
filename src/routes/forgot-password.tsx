import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Mail, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("重置邮件已发送");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "发送失败");
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
        <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> 返回登录
        </Link>
        <h1 className="mt-3 text-2xl font-bold">找回密码</h1>
        <p className="mt-1 text-sm text-muted-foreground">输入注册邮箱，我们会发送重置链接。</p>

        {sent ? (
          <div className="mt-6 rounded-xl glass p-5 text-sm text-center">
            ✨ 邮件已发送到 <span className="text-brand">{email}</span>
            <br />
            请查收邮件并点击链接重置密码。
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <div className="flex items-center gap-3 rounded-xl bg-input border border-border px-3 py-2.5 focus-within:border-brand transition">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="注册邮箱"
                className="flex-1 bg-transparent outline-none text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl btn-brand py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "发送重置邮件"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
