import { Link, useNavigate } from "@tanstack/react-router";
import { Sparkles, Settings as SettingsIcon, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { CreditBadge } from "@/components/CreditBadge";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useT } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const { user } = useAuth();
  const t = useT();
  const [isAdmin, setIsAdmin] = useState(false);
  useNavigate();

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    supabase
      .rpc("has_role", { _user_id: user.id, _role: "admin" })
      .then(({ data }) => setIsAdmin(data === true));
  }, [user]);

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 backdrop-blur-xl bg-background/60">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="grid h-8 w-8 place-items-center rounded-lg btn-brand">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-lg font-bold tracking-tight">TensorView</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          <a href="/#features" className="hover:text-foreground transition">{t("nav.features")}</a>
          <a href="/#showcase" className="hover:text-foreground transition">{t("nav.showcase")}</a>
          <Link to="/pricing" className="hover:text-foreground transition">{t("nav.pricing")}</Link>
          <Link to="/docs" className="hover:text-foreground transition">{t("nav.docs")}</Link>
        </nav>

        <div className="flex items-center gap-2">
          <LanguageToggle />
          {user ? (
            <>
              <CreditBadge />
              <Link
                to="/dashboard"
                search={{}}
                className="rounded-full px-4 py-1.5 text-sm hover:bg-accent/50 transition"
              >
                {t("nav.projects")}
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="grid h-9 w-9 place-items-center rounded-full hover:bg-accent/50 transition text-amber-300"
                  title={t("nav.admin")}
                >
                  <Shield className="h-4 w-4" />
                </Link>
              )}
              <Link
                to="/settings"
                className="grid h-9 w-9 place-items-center rounded-full hover:bg-accent/50 transition"
                title={t("nav.settings")}
              >
                <SettingsIcon className="h-4 w-4" />
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/auth"
                className="rounded-full px-4 py-1.5 text-sm hover:bg-accent/50 transition"
              >
                {t("nav.login")}
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="rounded-full btn-brand px-4 py-1.5 text-sm font-medium"
              >
                {t("nav.signup")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
