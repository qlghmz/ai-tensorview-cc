import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Smartphone, Lock, User, ShieldCheck } from "lucide-react";
import pigLogo from "@/assets/pig-logo.png";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "注册 — 飞猪旅行" },
      { name: "description", content: "注册飞猪旅行账户，开启无忧出行体验。" },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [agree, setAgree] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: "var(--gradient-hero)" }}>
      <div className="w-full max-w-[920px] grid md:grid-cols-2 rounded-3xl overflow-hidden bg-white shadow-[var(--shadow-card)]">
        <div className="p-8 md:p-10 order-2 md:order-1">
          <Link to="/" className="md:hidden flex items-center gap-2 mb-6">
            <img src={pigLogo} alt="飞猪旅行" className="h-10 w-10" />
            <span className="text-xl font-bold">飞猪旅行</span>
          </Link>

          <h1 className="text-2xl font-bold">创建账户</h1>
          <p className="mt-1 text-sm text-muted-foreground">注册即可领取新人 88 元礼包</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ to: "/login" });
            }}
            className="mt-6 space-y-4"
          >
            <Field icon={<User className="h-4 w-4 text-muted-foreground" />} placeholder="昵称（2-16 个字符）" />
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 focus-within:border-brand-orange transition">
              <Smartphone className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">+86</span>
              <input type="tel" placeholder="手机号" className="flex-1 bg-transparent outline-none text-sm" />
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 focus-within:border-brand-orange transition">
              <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0" />
              <input placeholder="短信验证码" className="flex-1 bg-transparent outline-none text-sm" />
              <button type="button" className="text-sm font-medium text-brand-orange hover:opacity-80">获取验证码</button>
            </div>
            <Field icon={<Lock className="h-4 w-4 text-muted-foreground" />} placeholder="设置密码（8-20 位）" type="password" />
            <Field icon={<Lock className="h-4 w-4 text-muted-foreground" />} placeholder="确认密码" type="password" />

            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-0.5 accent-[var(--brand-orange)]"
              />
              <span>
                我已阅读并同意
                <a className="text-brand-orange mx-1">《飞猪服务协议》</a>
                和
                <a className="text-brand-orange mx-1">《隐私政策》</a>
              </span>
            </label>

            <button
              type="submit"
              disabled={!agree}
              className="w-full rounded-full py-3 text-base font-semibold text-foreground shadow-[var(--shadow-glow)] hover:scale-[1.01] transition disabled:opacity-50 disabled:hover:scale-100"
              style={{ background: "var(--gradient-pill)" }}
            >
              立即注册
            </button>

            <p className="text-center text-sm text-muted-foreground">
              已有账号？{" "}
              <Link to="/login" className="text-brand-orange font-medium hover:opacity-80">立即登录</Link>
            </p>
          </form>
        </div>

        <div className="hidden md:flex flex-col justify-between p-10 text-foreground order-1 md:order-2" style={{ background: "var(--gradient-yellow)" }}>
          <Link to="/" className="flex items-center gap-2 self-end">
            <img src={pigLogo} alt="飞猪旅行" className="h-12 w-12" />
            <span className="text-2xl font-bold">飞猪旅行</span>
          </Link>
          <div>
            <h2 className="text-3xl font-bold leading-snug">新人专享<br />88 元大礼包 🎁</h2>
            <ul className="mt-4 space-y-2 text-sm text-foreground/80">
              <li>· 30 元机票券</li>
              <li>· 50 元酒店券</li>
              <li>· 8 元火车票券</li>
            </ul>
          </div>
          <div className="text-xs text-foreground/60">注册即视为同意《飞猪服务协议》</div>
        </div>
      </div>
    </div>
  );
}

function Field({ icon, placeholder, type = "text" }: { icon: React.ReactNode; placeholder: string; type?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 focus-within:border-brand-orange transition">
      <span className="shrink-0">{icon}</span>
      <input type={type} placeholder={placeholder} className="flex-1 bg-transparent outline-none text-sm" />
    </div>
  );
}
