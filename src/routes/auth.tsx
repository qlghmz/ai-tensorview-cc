import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Sparkles, Mail, Lock, Loader2, Phone, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";
import { useI18n, useT } from "@/lib/i18n";
import { toast } from "sonner";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  prompt: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Log in or sign up — TensorView" },
      { name: "description", content: "Log in or create a free TensorView account to start building websites with AI." },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [
      { rel: "canonical", href: "https://ai.tensorview.cc/auth" },
      { rel: "alternate", hrefLang: "zh-CN", href: "https://ai.tensorview.cc/auth" },
      { rel: "alternate", hrefLang: "en", href: "https://ai.tensorview.cc/auth" },
      { rel: "alternate", hrefLang: "x-default", href: "https://ai.tensorview.cc/auth" },
    ],
  }),
  component: AuthPage,
});

type Method = "email" | "phone";

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const t = useT();
  const { lang } = useI18n();
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

  // Update document title reactively when language changes
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = lang === "en"
      ? "Log in or sign up — TensorView"
      : "登录 / 注册 — TensorView";
  }, [lang]);

  const resendVerification = async () => {
    if (!email.trim()) return toast.error(t("auth.toast.needEmail"));
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin + "/dashboard" },
      });
      if (error) throw error;
      toast.success(t("auth.toast.resent"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("auth.toast.sendFail"));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      const target = search.prompt
        ? `/dashboard?prompt=${encodeURIComponent(search.prompt)}`
        : "/dashboard";
      try {
        navigate({ to: "/dashboard", search: search.prompt ? { prompt: search.prompt } : {} });
      } catch {
        window.location.href = target;
      }
      const t2 = setTimeout(() => {
        if (window.location.pathname.startsWith("/auth")) {
          window.location.href = target;
        }
      }, 500);
      return () => clearTimeout(t2);
    }
  }, [user, authLoading, navigate, search.prompt]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const ti = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(ti);
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
        toast.success(t("auth.toast.signupOk"));
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success(t("auth.toast.signinOk"));
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
      const msg = err instanceof Error ? err.message : t("auth.toast.opFail");
      toast.error(msg.includes("Invalid login") ? t("auth.toast.signinFail") : msg);
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = async () => {
    if (!phone.trim()) return toast.error(t("auth.toast.needPhone"));
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: phone.trim(),
        options: mode === "signup" ? { data: { display_name: name || phone } } : undefined,
      });
      if (error) throw error;
      setOtpSent(true);
      setCooldown(60);
      toast.success(t("auth.toast.otpSent"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("auth.toast.otpSendFail");
      toast.error(msg.includes("Phone provider") ? t("auth.toast.phoneUnavail") : msg);
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
      toast.success(t("auth.toast.verifyOk"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("auth.toast.verifyFail"));
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
        toast.error(t("auth.toast.googleFail"));
        setBusy(false);
      }
    } catch {
      toast.error(t("auth.toast.googleFail"));
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
        <h1 className="text-2xl font-bold">{mode === "signup" ? t("auth.signup.title") : t("auth.signin.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signup" ? t("auth.signup.sub") : t("auth.signin.sub")}
        </p>

        <button
          onClick={google}
          disabled={busy}
          className="mt-6 w-full rounded-xl border border-border bg-card hover:bg-accent/40 transition py-2.5 text-sm font-medium flex items-center justify-center gap-2"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#fff" opacity=".7" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/></svg>
          {t("auth.google")}
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
              {m === "email" ? t("auth.method.email") : t("auth.method.phone")}
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
                  placeholder={t("auth.name.placeholder")}
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
                placeholder={t("auth.email.placeholder")}
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
                placeholder={t("auth.password.placeholder")}
                className="flex-1 bg-transparent outline-none text-sm"
              />
            </Field>

            {mode === "signin" && (
              <div className="text-right">
                <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-brand">
                  {t("auth.forgot")}
                </Link>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl btn-brand py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : mode === "signup" ? t("auth.submit.signup") : t("auth.submit.signin")}
            </button>
            {mode === "signup" && (
              <div className="text-center text-xs text-muted-foreground">
                {t("auth.signup.resend.hint")}
                <button type="button" onClick={resendVerification} className="ml-1 text-brand hover:underline">
                  {t("auth.signup.resend.action")}
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
                  placeholder={t("auth.phone.name.placeholder")}
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
                placeholder={t("auth.phone.placeholder")}
                className="flex-1 bg-transparent outline-none text-sm"
              />
            </Field>
            <Field icon={KeyRound}>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder={t("auth.otp.placeholder")}
                className="flex-1 bg-transparent outline-none text-sm tracking-widest"
              />
              <button
                type="button"
                onClick={sendOtp}
                disabled={busy || cooldown > 0 || !phone}
                className="text-xs px-3 py-1 rounded-lg btn-brand disabled:opacity-40 whitespace-nowrap"
              >
                {cooldown > 0 ? `${cooldown}s` : otpSent ? t("auth.otp.resend") : t("auth.otp.get")}
              </button>
            </Field>

            <button
              type="submit"
              disabled={busy || !otp}
              className="w-full rounded-xl btn-brand py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : mode === "signup" ? t("auth.phone.submit.signup") : t("auth.phone.submit.signin")}
            </button>

            <p className="text-xs text-center text-muted-foreground">
              {t("auth.phone.hint")}
            </p>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "signup" ? t("auth.switch.toSignin") : t("auth.switch.toSignup")}{" "}
          <button
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="text-brand hover:opacity-80 font-medium"
          >
            {mode === "signup" ? t("auth.switch.signinLink") : t("auth.switch.signupLink")}
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
