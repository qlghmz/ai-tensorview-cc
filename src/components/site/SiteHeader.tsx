import { Link, useNavigate } from "@tanstack/react-router";
import { Sparkles, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export function SiteHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 backdrop-blur-xl bg-background/60">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="grid h-8 w-8 place-items-center rounded-lg btn-brand">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-lg font-bold tracking-tight">特挠率i额外</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          <a href="/#features" className="hover:text-foreground transition">功能</a>
          <a href="/#showcase" className="hover:text-foreground transition">案例</a>
          <a href="/#pricing" className="hover:text-foreground transition">价格</a>
          <a href="/#faq" className="hover:text-foreground transition">FAQ</a>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className="rounded-full px-4 py-1.5 text-sm hover:bg-accent/50 transition"
              >
                项目
              </Link>
              <button
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/" });
                }}
                className="grid h-9 w-9 place-items-center rounded-full hover:bg-accent/50 transition"
                title="退出"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link
                to="/auth"
                className="rounded-full px-4 py-1.5 text-sm hover:bg-accent/50 transition"
              >
                登录
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="rounded-full btn-brand px-4 py-1.5 text-sm font-medium"
              >
                免费开始
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
