import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/fliggy/Header";
import { Footer } from "@/components/fliggy/Footer";
import { Crown, Gift, Heart, MapPin, Wallet, Settings, ChevronRight, Plane, Building2, Train, Ticket } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "个人中心 — 飞猪旅行" },
      { name: "description", content: "管理飞猪账户、查看会员等级、积分与优惠券。" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-hero)" }}>
      <Header />

      <div className="mx-auto max-w-[1200px] px-6 py-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Profile card */}
        <aside className="rounded-3xl overflow-hidden bg-white shadow-[var(--shadow-card)]">
          <div className="p-6 text-foreground" style={{ background: "var(--gradient-yellow)" }}>
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-full bg-white/80 grid place-items-center text-2xl font-bold">小</div>
              <div>
                <div className="text-lg font-bold">小飞猪</div>
                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-foreground/10 px-2 py-0.5 text-xs">
                  <Crown className="h-3 w-3" /> F4 钻石会员
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 text-center">
              {[
                { n: "12,580", l: "积分" },
                { n: "8", l: "优惠券" },
                { n: "36", l: "里程" },
              ].map((x) => (
                <div key={x.l}>
                  <div className="font-bold">{x.n}</div>
                  <div className="text-xs text-foreground/70">{x.l}</div>
                </div>
              ))}
            </div>
          </div>

          <nav className="p-2">
            {[
              { i: <Wallet className="h-4 w-4" />, l: "我的钱包", to: "/profile" as const },
              { i: <Gift className="h-4 w-4" />, l: "优惠券与红包", to: "/profile" as const },
              { i: <Heart className="h-4 w-4" />, l: "我的收藏", to: "/profile" as const },
              { i: <MapPin className="h-4 w-4" />, l: "常用地址", to: "/profile" as const },
              { i: <Settings className="h-4 w-4" />, l: "账户设置", to: "/profile" as const },
            ].map((m) => (
              <Link
                key={m.l}
                to={m.to}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/60 transition"
              >
                <span className="text-muted-foreground">{m.i}</span>
                <span className="text-sm flex-1">{m.l}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </nav>
        </aside>

        <section className="space-y-6">
          {/* Quick actions */}
          <div className="rounded-3xl bg-white p-6 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">我的订单</h2>
              <Link to="/orders" className="text-sm text-brand-orange hover:opacity-80 flex items-center gap-1">
                查看全部 <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="mt-5 grid grid-cols-4 gap-3">
              {[
                { i: Plane, l: "机票", c: "var(--gradient-card-air)" },
                { i: Building2, l: "酒店", c: "var(--gradient-card-hotel)" },
                { i: Train, l: "火车票", c: "var(--gradient-card-train)" },
                { i: Ticket, l: "门票", c: "var(--gradient-card-ticket)" },
              ].map((x) => (
                <Link
                  key={x.l}
                  to="/orders"
                  className="flex flex-col items-center gap-2 rounded-2xl bg-muted/40 py-5 hover:bg-muted transition"
                >
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-[var(--shadow-soft)]"
                    style={{ background: x.c }}
                  >
                    <x.i className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-medium">{x.l}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Member benefits */}
          <div className="rounded-3xl p-6 text-foreground shadow-[var(--shadow-card)]" style={{ background: "var(--gradient-yellow)" }}>
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              <h2 className="text-lg font-bold">F4 钻石会员特权</h2>
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              {["机票优享", "酒店升级", "专属客服", "免费退改"].map((t) => (
                <div key={t} className="rounded-2xl bg-white/70 backdrop-blur p-4 text-center">
                  <div className="text-2xl">🎁</div>
                  <div className="mt-2 text-sm font-medium">{t}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          <div className="rounded-3xl bg-white p-6 shadow-[var(--shadow-soft)]">
            <h2 className="text-lg font-bold">为你推荐</h2>
            <p className="mt-1 text-sm text-muted-foreground">根据你的浏览记录精选</p>
            <div className="mt-4">
              <Link to="/search" className="inline-flex items-center gap-1 text-sm text-brand-orange hover:opacity-80">
                探索更多酒店 <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}
