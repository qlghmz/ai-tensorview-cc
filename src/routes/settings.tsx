import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Loader2, User, LogOut, Sparkles, Mail, Save, Lock, Languages } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SiteHeader } from "@/components/site/SiteHeader";
import { CreditsPanel } from "@/components/CreditsPanel";
import { RedeemCouponPanel } from "@/components/RedeemCouponPanel";
import { ApiKeysPanel } from "@/components/ApiKeysPanel";
import { useI18n } from "@/lib/i18n";
import { pickLang, localizedMeta, localizedLinks } from "@/lib/seo-head";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  loader: ({ context }) => ({ lang: (context as { lang?: "zh" | "en" }).lang ?? "en" }),
  head: ({ loaderData }) => {
    const lang = pickLang(loaderData);
    return {
      meta: [
        ...localizedMeta(lang, "seo.settings.title", "seo.settings.desc", "/settings"),
        { name: "robots", content: "noindex, follow" },
      ],
      links: localizedLinks("/settings"),
    };
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
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
    if (error) return toast.error(t("settings.toast.saveFail"));
    toast.success(t("settings.toast.saveOk"));
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
              <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("settings.subtitle")}</p>
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
                <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{user.email ?? t("settings.email.empty")}</div>
                <div className="text-xs mt-1">{t("settings.userId")}：{user.id.slice(0, 8)}…</div>
              </div>
            </div>

            <Field label={t("settings.field.displayName")}>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("settings.field.displayName.placeholder")}
                className="flex-1 bg-transparent outline-none text-sm"
              />
            </Field>
            <Field label={t("settings.field.avatar")}>
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
              {t("settings.save")}
            </button>
          </section>
          <CreditsPanel />
          <RedeemCouponPanel />
          <div className="mt-5">
            <ApiKeysPanel />
          </div>
          <AiProvidersSection />
          <LanguageSection />


          <PasswordSection />
          <section className="glass rounded-3xl p-6 mt-5">
            <div className="font-semibold mb-1">{t("settings.forgot.title")}</div>
            <p className="text-sm text-muted-foreground mb-4">{t("settings.forgot.sub")}</p>
            <Link to="/forgot-password" className="rounded-xl glass px-4 py-2 text-sm hover:border-brand/40 transition inline-flex">
              {t("settings.forgot.cta")}
            </Link>
          </section>

          <section className="glass rounded-3xl p-6 mt-5 border-destructive/40">
            <div className="font-semibold mb-1">{t("settings.signout.title")}</div>
            <p className="text-sm text-muted-foreground mb-4">{t("settings.signout.sub")}</p>
            <button
              onClick={async () => {
                await signOut();
                navigate({ to: "/" });
              }}
              className="rounded-xl bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30 transition px-4 py-2 text-sm font-medium inline-flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" /> {t("settings.signout.cta")}
            </button>
          </section>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 inline mr-1" />
            {t("settings.upgrade.prefix")}
            <Link to="/pricing" className="text-brand hover:underline ml-1">{t("settings.upgrade.link")}</Link>
          </p>
        </main>
      </div>
    </div>
  );
}

function AiProvidersSection() {
  const { lang } = useI18n();
  const zh = lang === "zh";
  return (
    <section className="glass rounded-3xl p-6 mt-5">
      <div className="font-semibold mb-1">{zh ? "AI 模型配置" : "AI providers"}</div>
      <p className="text-sm text-muted-foreground mb-3">
        {zh
          ? "在服务器环境变量中配置（.env.local / Cloudflare Secrets）。支持通义千问、Gemini、Ollama、OpenAI 兼容网关。"
          : "Configure via server env (.env.local / Cloudflare Secrets): DashScope, Gemini, Ollama, OpenAI-compatible."}
      </p>
      <ul className="text-xs text-muted-foreground space-y-1 font-mono">
        <li>DASHSCOPE_API_KEY / DASHSCOPE_MODEL</li>
        <li>OLLAMA_BASE_URL=http://127.0.0.1:11434 + OLLAMA_MODEL</li>
        <li>CUSTOM_AI_API_KEY / CUSTOM_AI_BASE_URL</li>
      </ul>
      <Link to="/docs/api" className="inline-block mt-3 text-sm text-brand hover:underline">
        {zh ? "查看 API 文档 →" : "API docs →"}
      </Link>
    </section>
  );
}

function LanguageSection() {
  const { lang, setLang, t } = useI18n();
  return (
    <section className="glass rounded-3xl p-6 mt-5">
      <div className="flex items-center gap-2 mb-1">
        <Languages className="h-4 w-4 text-brand" />
        <div className="font-semibold">{t("settings.language.title")}</div>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{t("settings.language.desc")}</p>
      <div className="inline-flex rounded-xl border border-border bg-input p-1">
        {(["zh", "en"] as const).map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              lang === code ? "btn-brand" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {code === "zh" ? "中文" : "English"}
          </button>
        ))}
      </div>
    </section>
  );
}

function PasswordSection() {
  const { t } = useI18n();
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (pwd.length < 6) return toast.error(t("settings.password.toast.short"));
    if (pwd !== pwd2) return toast.error(t("settings.password.toast.mismatch"));
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusy(false);
    if (error) return toast.error(error.message);
    setPwd("");
    setPwd2("");
    toast.success(t("settings.password.toast.ok"));
  };

  return (
    <section className="glass rounded-3xl p-6 mt-5">
      <div className="flex items-center gap-2 mb-1">
        <Lock className="h-4 w-4 text-brand" />
        <div className="font-semibold">{t("settings.password.title")}</div>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{t("settings.password.sub")}</p>
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-xl bg-input border border-border px-3 py-2.5 focus-within:border-brand transition">
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder={t("settings.password.new.placeholder")}
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-input border border-border px-3 py-2.5 focus-within:border-brand transition">
          <input
            type="password"
            value={pwd2}
            onChange={(e) => setPwd2(e.target.value)}
            placeholder={t("settings.password.confirm.placeholder")}
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
        <button
          onClick={submit}
          disabled={busy || !pwd || !pwd2}
          className="rounded-xl btn-brand px-5 py-2.5 text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {t("settings.password.submit")}
        </button>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-muted-foreground mb-1.5">{label}</div>
      <div className="flex items-center gap-3 rounded-xl bg-input border border-border px-3 py-2.5 focus-within:border-brand transition">
        {children}
      </div>
    </label>
  );
}
