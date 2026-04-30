import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Smartphone, Lock, Eye, EyeOff } from "lucide-react";
import pigLogo from "@/assets/pig-logo.png";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "登录 — 飞猪旅行" },
      { name: "description", content: "登录飞猪旅行账户，管理订单、享受会员专属优惠。" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"sms" | "pwd">("sms");
  const [showPwd, setShowPwd] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--gradient-hero)" }}>
      <div className="w-full max-w-[920px] grid md:grid-cols-2 rounded-3xl overflow-hidden bg-white shadow-[var(--shadow-card)]">
        {/* Brand side */}
        <div className="hidden md:flex flex-col justify-between p-10 text-foreground" style={{ background: "var(--gradient-yellow)" }}>
          <Link to="/" className="flex items-center gap-2">
            <img src={pigLogo} alt="飞猪旅行" className="h-12 w-12" />
            <span className="text-2xl font-bold">飞猪旅行</span>
          </Link>
          <div>
            <h2 className="text-3xl font-bold leading-snug">开启你的<br />下一段旅程 ✈️</h2>
            <p className="mt-3 text-sm text-foreground/75">机票、酒店、火车票、度假，一站搞定。</p>
          </div>
          <div className="flex gap-2">
            <span className="h-1.5 w-8 rounded-full bg-foreground/70" />
            <span className="h-1.5 w-2 rounded-full bg-foreground/30" />
            <span className="h-1.5 w-2 rounded-full bg-foreground/30" />
          </div>
        </div>

        {/* Form side */}
        <div className="p-8 md:p-10">
          <div className="md:hidden flex items-center gap-2 mb-6">
            <img src={pigLogo} alt="飞猪旅行" className="h-10 w-10" />
            <span className="text-xl font-bold">飞猪旅行</span>
          </div>

          <h1 className="text-2xl font-bold">欢迎登录</h1>
          <p className="mt-1 text-sm text-muted-foreground">登录后享受更多会员权益</p>

          <div className="mt-6 flex gap-6 border-b border-border">
            {[
              { k: "sms", l: "短信验证码" },
              { k: "pwd", l: "密码登录" },
            ].map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k as "sms" | "pwd")}
                className={`relative pb-3 text-sm font-medium transition ${
                  tab === t.k ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.l}
                {tab === t.k && (
                  <span className="absolute -bottom-px left-0 right-0 h-0.5 rounded bg-brand-orange" />
                )}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ to: "/" });
            }}
            className="mt-6 space-y-4"
          >
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 focus-within:border-brand-orange transition">
              <Smartphone className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">+86</span>
              <input
                type="tel"
                placeholder="请输入手机号"
                className="flex-1 bg-transparent outline-none text-sm"
              />
            </div>

            {tab === "sms" ? (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 focus-within:border-brand-orange transition">
                <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  placeholder="请输入验证码"
                  className="flex-1 bg-transparent outline-none text-sm"
                />
                <button
                  type="button"
                  className="text-sm font-medium text-brand-orange hover:opacity-80"
                >
                  获取验证码
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 focus-within:border-brand-orange transition">
                <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  type={showPwd ? "text" : "password"}
                  placeholder="请输入密码"
                  className="flex-1 bg-transparent outline-none text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-muted-foreground">
                <input type="checkbox" className="accent-[var(--brand-orange)]" />
                记住我
              </label>
              <button type="button" className="text-brand-orange hover:opacity-80">忘记密码？</button>
            </div>

            <button
              type="submit"
              className="w-full rounded-full py-3 text-base font-semibold text-foreground shadow-[var(--shadow-glow)] hover:scale-[1.01] transition"
              style={{ background: "var(--gradient-pill)" }}
            >
              登录
            </button>

            <p className="text-center text-sm text-muted-foreground">
              还没有账号？{" "}
              <Link to="/register" className="text-brand-orange font-medium hover:opacity-80">
                立即注册
              </Link>
            </p>

            <div className="relative my-2 text-center">
              <span className="relative z-10 bg-white px-3 text-xs text-muted-foreground">其他登录方式</span>
              <span className="absolute left-0 right-0 top-1/2 h-px bg-border" />
            </div>

            <div className="flex justify-center gap-4">
              {["支", "微", "Q"].map((t) => (
                <button
                  key={t}
                  type="button"
                  className="h-10 w-10 rounded-full border border-border bg-white text-sm font-bold hover:border-brand-orange hover:text-brand-orange transition"
                >
                  {t}
                </button>
              ))}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
