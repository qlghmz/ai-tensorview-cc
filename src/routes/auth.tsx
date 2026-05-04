import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Sparkles, Mail, Lock, Loader2, Phone, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  prompt: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  component: AuthPage,
});

type Method = "email" | "phone";

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [method, setMethod] = useState<Method>("email");

  // email
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  // phone
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [busy, setBusy] = useState(false);

  const resendVerification = async () => {
    if (!email.trim()) return toast.error("请先输入邮箱");
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin + "/dashboard" },
      });
      if (error) throw error;
      toast.success("验证邮件已重新发送");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "发送失败，请稍后再试");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      const target = search.prompt
        ? `/dashboard?prompt=${encodeURIComponent(search.prompt)}`
        : "/dashboard";
      // 用 hard navigation 避免预览环境下 dynamic import 失败导致客户端路由卡住
      try {
        navigate({ to: "/dashboard", search: search.prompt ? { prompt: search.prompt } : {} });
      } catch {
        window.location.href = target;
      }
      // 兜底：500ms 后如果还在 /auth，强制跳转
      const t = setTimeout(() => {
        if (window.location.pathname.startsWith("/auth")) {
          window.location.href = target;
        }
      }, 500);
      return () => clearTimeout(t);
    }
  }, [user, authLoading, navigate, search.prompt]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/dashboard",
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("验证邮件已发送，请先到邮箱确认后再登录");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("登录成功，正在跳转…");
        if (data.session) {
          const target = search.prompt
            ? `/dashboard?prompt=${encodeURIComponent(search.prompt)}`
            : "/dashboard";
          setTimeout(() => {
            window.location.href = target;
          }, 300);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "操作失败";
      toast.error(msg.includes("Invalid login") ? "邮箱或密码错误" : msg);
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = async () => {
    if (!phone.trim()) return toast.error("请输入手机号");
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: phone.trim(),
        options: mode === "signup" ? { data: { display_name: name || phone } } : undefined,
      });
      if (error) throw error;
      setOtpSent(true);
      setCooldown(60);
      toast.success("验证码已发送");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "发送失败";
      toast.error(msg.includes("Phone provider") ? "手机号登录暂未启用，请联系管理员" : msg);
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: phone.trim(),
        token: otp.trim(),
        type: "sms",
      });
      if (error) throw error;
      toast.success("登录成功");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "验证失败");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/dashboard",
      });
      if (result.error) {
        toast.error("Google 登录失败");
        setBusy(false);
      }
    } catch {
      toast.error("Google 登录失败");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen relative grid place-items-center px-4 overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
      <div className="absolute inset-0 bg-grid pointer-events-none" />

      <Link to="/" className="absolute top-6 left-6 flex items-center gap-2 group">
        <span className="grid h-8 w-8 place-items-center rounded-lg btn-brand">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="text-lg font-bold">TensorView</span>
      </Link>

      <div className="relative w-full max-w-md glass rounded-3xl p-8 shadow-[var(--shadow-card)]">
        <h1 className="text-2xl font-bold">{mode === "signup" ? "创建账户" : "欢迎回来"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signup" ? "注册后需要先完成邮箱验证。" : "登录继续你的创作。"}
        </p>

        <button
          onClick={google}
          disabled={busy}
          className="mt-6 w-full rounded-xl border border-border bg-card hover:bg-accent/40 transition py-2.5 text-sm font-medium flex items-center justify-center gap-2"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#fff" opacity=".7" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/></svg>
          使用 Google 继续
        </button>

        {/* Method tabs */}
        <div className="mt-5 flex items-center rounded-xl glass p-1 text-sm">
          {(["email", "phone"] as Method[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMethod(m);
                setOtpSent(false);
              }}
              className={`flex-1 rounded-lg py-1.5 transition ${method === m ? "btn-brand" : "text-muted-foreground hover:text-foreground"}`}
            >
              {m === "email" ? "邮箱" : "手机号"}
            </button>
          ))}
        </div>

        {method === "email" ? (
          <form onSubmit={submitEmail} className="mt-4 space-y-3">
            {mode === "signup" && (
              <Field icon={Sparkles}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="显示名称"
                  className="flex-1 bg-transparent outline-none text-sm"
                />
              </Field>
            )}
            <Field icon={Mail}>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="邮箱"
                className="flex-1 bg-transparent outline-none text-sm"
              />
            </Field>
            <Field icon={Lock}>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码（至少 6 位）"
                className="flex-1 bg-transparent outline-none text-sm"
              />
            </Field>

            {mode === "signin" && (
              <div className="text-right">
                <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-brand">
                  忘记密码？
                </Link>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl btn-brand py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : mode === "signup" ? "创建账户" : "登录"}
            </button>
            {mode === "signup" && (
              <div className="text-center text-xs text-muted-foreground">
                没收到邮件时，请先检查垃圾箱；同一邮箱短时间重复注册可能不会连续发送。
                <button type="button" onClick={resendVerification} className="ml-1 text-brand hover:underline">
                  重新发送
                </button>
              </div>
            )}
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="mt-4 space-y-3">
            {mode === "signup" && (
              <Field icon={Sparkles}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="显示名称（可选）"
                  className="flex-1 bg-transparent outline-none text-sm"
                />
              </Field>
            )}
            <Field icon={Phone}>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="手机号（含国家代码，如 +8613800138000）"
                className="flex-1 bg-transparent outline-none text-sm"
              />
            </Field>
            <Field icon={KeyRound}>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6 位短信验证码"
                className="flex-1 bg-transparent outline-none text-sm tracking-widest"
              />
              <button
                type="button"
                onClick={sendOtp}
                disabled={busy || cooldown > 0 || !phone}
                className="text-xs px-3 py-1 rounded-lg btn-brand disabled:opacity-40 whitespace-nowrap"
              >
                {cooldown > 0 ? `${cooldown}s` : otpSent ? "重新发送" : "获取验证码"}
              </button>
            </Field>

            <button
              type="submit"
              disabled={busy || !otp}
              className="w-full rounded-xl btn-brand py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : mode === "signup" ? "注册并登录" : "登录"}
            </button>

            <p className="text-xs text-center text-muted-foreground">
              提示：手机号登录需在后端启用 SMS 服务商。
            </p>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "signup" ? "已有账户？" : "还没有账户？"}{" "}
          <button
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="text-brand hover:opacity-80 font-medium"
          >
            {mode === "signup" ? "登录" : "注册"}
          </button>
        </p>
      </div>
    </div>
  );
}

function Field({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-input border border-border px-3 py-2.5 focus-within:border-brand transition">
      <Icon className="h-4 w-4 text-muted-foreground" />
      {children}
    </div>
  );
}
