import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Sparkles, WalletCards } from "lucide-react";
import { useState } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { createOrder } from "@/server/orders.functions";
import { sendTransactionalEmail } from "@/lib/email/send";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import payAlipay from "@/assets/pay-alipay.jpg";
import payWechat from "@/assets/pay-wechat.png";

export const Route = createFileRoute("/pricing")({
  loader: ({ context }) => ({ lang: (context as { lang?: "zh" | "en" }).lang ?? "en" }),
  head: ({ loaderData }) => {
    const lang = pickLang(loaderData);
    return {
      meta: localizedMeta(lang, "seo.pricing.title", "seo.pricing.desc", "/pricing"),
      links: localizedLinks("/pricing"),
    };
  },
  component: PricingPage,
});

type Plan = { name: string; planKey: "free" | "pro" | "team"; price: string; period: string; desc: string; cta: string; features: string[]; highlight: boolean };


function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const PLANS: Plan[] = lang === "en" ? [
    { name: "Free", planKey: "free", price: "¥0", period: "forever", desc: "For trying out and small projects", cta: "Get started",
      features: ["100 credits on sign-up", "Daily top-up to 10 credits", "Unlimited projects", "Public preview links"], highlight: false },
    { name: "Pro", planKey: "pro", price: "¥69", period: t("pricing.month"), desc: "For solo creators", cta: "Upgrade to Pro",
      features: ["200 Pro credits / month", "Daily top-up to 10 credits", "Unlimited projects", "Custom domains", "Priority email support"], highlight: true },
    { name: "Team", planKey: "team", price: "¥299", period: t("pricing.month"), desc: "For team collaboration", cta: "Upgrade to Team",
      features: ["1000 Team credits / month", "Daily top-up to 10 credits", "Team collaboration (5 seats)", "Project permissions", "Dedicated support"], highlight: false },
  ] : [
    { name: "免费", planKey: "free", price: "¥0", period: "永久免费", desc: "适合体验和小项目", cta: "开始使用",
      features: ["注册赠送 100 credits", "每日补到 10 credits", "无限项目", "公开预览链接"], highlight: false },
    { name: "专业", planKey: "pro", price: "¥69", period: "/月", desc: "适合个人创作者", cta: "升级专业版",
      features: ["每月 200 Pro credits", "每日补到 10 credits", "无限项目", "自定义域名", "优先邮件支持"], highlight: true },
    { name: "团队", planKey: "team", price: "¥299", period: "/月", desc: "适合团队协作", cta: "升级团队版",
      features: ["每月 1000 Team credits", "每日补到 10 credits", "团队协作（5 席位）", "项目权限管理", "专属客服"], highlight: false },
  ];
  const [order, setOrder] = useState<{ orderNo: string; plan: string; amount: number; payUrl?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // 爱发电下单页：每个套餐对应一个赞助方案的 plan_id
  const AFDIAN_PLAN_URL: Record<string, string> = {
    pro: "https://ifdian.net/order/create?plan_id=b7c02f6e49c611f1ba7352540025c377",
    team: "https://ifdian.net/order/create?plan_id=c1ba622849c611f192fd52540025c377",
  };

  const handleUpgrade = async (plan: Plan) => {
    if (plan.planKey === "free") {
      navigate({ to: user ? "/dashboard" : "/auth", search: user ? {} : { mode: "signup" } });
      return;
    }
    if (!user) {
      navigate({ to: "/auth", search: { mode: "signup" } });
      return;
    }
    setBusy(true);
    try {
      const row = await createOrder({ data: { plan: plan.planKey } });
      const baseUrl = AFDIAN_PLAN_URL[plan.planKey];
      const payUrl = baseUrl
        ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}custom_order_id=${encodeURIComponent(row.order_no as string)}`
        : undefined;
      setOrder({
        orderNo: row.order_no as string,
        plan: row.plan as string,
        amount: row.amount_cny as number,
        payUrl,
      });
      // Fire-and-forget order confirmation email — failure must not block UI.
      if (user?.email) {
        sendTransactionalEmail({
          templateName: "order-created",
          recipientEmail: user.email,
          idempotencyKey: `order-created-${row.id}`,
          templateData: {
            orderNo: row.order_no,
            plan: row.plan,
            amount: row.amount_cny,
          },
        }).catch((e) => console.warn("order-created email failed", e));
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="min-h-screen relative" style={{ background: "var(--gradient-hero)" }}>
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="relative">
        <SiteHeader />
        <main className="mx-auto max-w-[1200px] px-6 py-20">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 text-brand" /> {t("pricing.badge")}
            </div>
            <h1 className="mt-5 text-4xl md:text-6xl font-bold">
              {t("pricing.heroTitle.1")}<span className="text-gradient">{t("pricing.heroTitle.2")}</span>
            </h1>
            <p className="mt-4 text-muted-foreground">{t("pricing.heroSub")}</p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-3 max-w-5xl mx-auto">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`relative rounded-3xl p-7 ${p.highlight ? "glass border-brand/60 shadow-[var(--shadow-glow)]" : "glass"}`}
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full btn-brand px-3 py-1 text-xs font-semibold">
                    {t("pricing.popular")}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">{p.name}</div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{p.price}</span>
                  <span className="text-sm text-muted-foreground">{p.period}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
                <ul className="mt-5 space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-brand shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleUpgrade(p)}
                  disabled={busy}
                  className={`mt-6 block w-full text-center rounded-full py-2.5 text-sm font-semibold disabled:opacity-50 ${
                    p.highlight ? "btn-brand" : "border border-border hover:bg-accent/30 transition"
                  }`}
                >
                  {p.cta}
                </button>
              </div>
            ))}
          </div>

          <section className="mt-10 max-w-5xl mx-auto glass rounded-3xl p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl btn-brand shrink-0">
                <WalletCards className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">{t("pricing.payments.title")}</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-6">{t("pricing.payments.body")}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border px-3 py-1">{t("pricing.payments.paddle")}</span>
                  <span className="rounded-full border border-border px-3 py-1">{t("pricing.payments.alipay")}</span>
                  <span className="rounded-full border border-border px-3 py-1">{t("pricing.payments.wechat")}</span>
                </div>
              </div>
            </div>
          </section>

          <div className="mt-16 text-center text-sm text-muted-foreground">
            {t("pricing.help.prefix")}
            <Link to="/docs" className="text-brand hover:underline mx-1">{t("pricing.help.docs")}</Link>
            {t("pricing.help.or")}
            <a href="mailto:support@tensorview.cc" className="text-brand hover:underline mx-1">{t("pricing.help.contact")}</a>
          </div>
        </main>
        <SiteFooter />
      </div>

      <Dialog open={!!order} onOpenChange={(o) => !o && setOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>订单已创建</DialogTitle>
            <DialogDescription>
              通过爱发电完成支付，付款成功后会员将自动开通。
            </DialogDescription>
          </DialogHeader>
          {order && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">订单号</span>
                <span className="font-mono">{order.orderNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">套餐</span>
                <span>{order.plan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">金额</span>
                <span>¥{order.amount}</span>
              </div>

              {order.payUrl ? (
                <a
                  href={order.payUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full text-center btn-brand rounded-full py-2.5 font-semibold"
                >
                  前往爱发电支付 ¥{order.amount}
                </a>
              ) : null}

              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed">
                付款成功后会员将<strong className="text-foreground">自动开通</strong>，无需联系管理员。如长时间未到账，可联系
                <a className="text-brand mx-1" href="mailto:support@tensorview.cc">support@tensorview.cc</a>。
              </div>

              <details className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                <summary className="cursor-pointer">不便使用爱发电？查看二维码兜底支付</summary>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-lg overflow-hidden border border-border bg-white">
                    <div className="text-center text-xs font-semibold py-1.5 bg-[#1677ff] text-white">支付宝</div>
                    <img src={payAlipay} alt="支付宝收款码" className="w-full h-auto" />
                  </div>
                  <div className="rounded-lg overflow-hidden border border-border bg-white">
                    <div className="text-center text-xs font-semibold py-1.5 bg-[#07c160] text-white">微信支付</div>
                    <img src={payWechat} alt="微信收款码" className="w-full h-auto" />
                  </div>
                </div>
                <p className="mt-2 leading-relaxed">
                  扫码支付 ¥{order.amount}，备注订单号 <span className="font-mono">{order.orderNo}</span>，截图发送至
                  <a className="text-brand mx-1" href="mailto:support@tensorview.cc">support@tensorview.cc</a> 由管理员手动激活。
                </p>
              </details>

              <Button variant="outline" className="w-full" onClick={() => setOrder(null)}>
                关闭
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
