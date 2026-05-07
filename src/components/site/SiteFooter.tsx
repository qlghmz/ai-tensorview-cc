import { Link } from "@tanstack/react-router";

type Item = { t: string; href?: string; to?: "/pricing" | "/docs" | "/auth" };

export function SiteFooter() {
  const groups: { t: string; items: Item[] }[] = [
    {
      t: "产品",
      items: [
        { t: "功能", href: "/#features" },
        { t: "案例", href: "/#showcase" },
        { t: "价格", to: "/pricing" },
        { t: "更新日志", href: "#" },
      ],
    },
    {
      t: "资源",
      items: [
        { t: "文档", to: "/docs" },
        { t: "教程", href: "#" },
        { t: "社区", href: "#" },
        { t: "博客", href: "#" },
      ],
    },
    {
      t: "公司",
      items: [
        { t: "关于我们", href: "#" },
        { t: "联系", href: "mailto:support@tensorview.cc" },
        { t: "条款", href: "#" },
        { t: "隐私", href: "#" },
      ],
    },
  ];

  return (
    <footer className="border-t border-border/40 mt-24">
      <div className="mx-auto max-w-[1280px] px-6 py-10 grid gap-8 md:grid-cols-4 text-sm">
        <div>
          <div className="font-bold text-base">TensorView</div>
          <p className="mt-2 text-muted-foreground">用一句话生成可运行的网页和应用。</p>
        </div>
        {groups.map((c) => (
          <div key={c.t}>
            <div className="font-semibold">{c.t}</div>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              {c.items.map((x) => (
                <li key={x.t}>
                  {x.to ? (
                    <Link to={x.to} className="hover:text-foreground transition">{x.t}</Link>
                  ) : (
                    <a href={x.href ?? "#"} className="hover:text-foreground transition">{x.t}</a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border/40 py-5 text-center text-xs text-muted-foreground">
        © 2026 TensorView · 让创造更简单
      </div>
    </footer>
  );
}
