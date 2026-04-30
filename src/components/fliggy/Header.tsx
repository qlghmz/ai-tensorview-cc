import { Search, Camera, ShoppingCart, User } from "lucide-react";
import pigLogo from "@/assets/pig-logo.png";

export function Header() {
  return (
    <header className="w-full bg-gradient-to-b from-[oklch(0.96_0.08_95)] to-transparent">
      <div className="mx-auto flex max-w-[1200px] items-center gap-6 px-6 py-5">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 shrink-0">
          <img src={pigLogo} alt="飞猪旅行" width={48} height={48} className="h-12 w-12" />
          <span className="text-2xl font-bold tracking-tight text-foreground">
            飞猪<span className="text-brand-orange">旅行</span>
          </span>
        </a>

        {/* Search */}
        <div className="flex-1 flex items-center rounded-full bg-white shadow-[var(--shadow-soft)] pl-5 pr-1.5 py-1.5 max-w-[560px]">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="目的地 / 酒店 / 景点 / 签证等"
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button className="rounded-full bg-gradient-to-r from-brand-yellow to-brand-yellow-deep px-6 py-2 text-sm font-semibold text-foreground shadow-[var(--shadow-glow)] hover:scale-[1.02] transition-[var(--transition-smooth)]">
            搜索
          </button>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-5 text-sm text-foreground/80">
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 hover:bg-white transition">
            <ShoppingCart className="h-4 w-4" />
          </button>
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 hover:bg-white transition">
            <Camera className="h-4 w-4" />
          </button>
          <button className="hover:text-brand-orange transition">我的订单</button>
          <button className="rounded-full border border-foreground/15 px-4 py-1.5 hover:border-brand-orange hover:text-brand-orange transition">
            注册
          </button>
          <button className="rounded-full bg-foreground text-background px-4 py-1.5 hover:bg-foreground/85 transition flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            登录
          </button>
        </div>
      </div>
    </header>
  );
}
