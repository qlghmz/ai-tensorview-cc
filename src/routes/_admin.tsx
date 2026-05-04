import { createFileRoute, redirect, Outlet, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site/SiteHeader";

export const Route = createFileRoute("/_admin")({
  beforeLoad: async () => {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) throw redirect({ to: "/auth" });
  },
  component: AdminLayout,
});

function AdminLayout() {
  const [allowed, setAllowed] = useState<null | boolean>(null);
  const location = useLocation();

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) {
        setAllowed(false);
        return;
      }
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: uid,
        _role: "admin",
      });
      setAllowed(!error && data === true);
    })();
  }, []);

  if (allowed === null) {
    return <div className="p-12 text-center text-muted-foreground">加载中…</div>;
  }
  if (!allowed) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-2xl p-12 text-center">
          <h1 className="mb-3 text-2xl font-bold">无权访问</h1>
          <p className="text-muted-foreground">该页面仅限管理员</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { to: "/admin", label: "概览" },
    { to: "/admin/users", label: "用户" },
    { to: "/admin/orders", label: "订单" },
    { to: "/admin/projects", label: "项目" },
    { to: "/admin/credits", label: "积分流水" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-[1280px] px-6 py-8">
        <h1 className="mb-2 text-3xl font-bold">管理员后台</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          仅管理员可见 · 当前路径 {location.pathname}
        </p>
        <div className="mb-6 flex flex-wrap gap-2 border-b border-border">
          {tabs.map((t) => {
            const active =
              location.pathname === t.to ||
              (t.to !== "/admin" && location.pathname.startsWith(t.to));
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`px-4 py-2 text-sm transition ${
                  active
                    ? "border-b-2 border-primary text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
        <Outlet />
      </div>
    </div>
  );
}
