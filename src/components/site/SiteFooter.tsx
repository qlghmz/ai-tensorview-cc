export function SiteFooter() {
  return (
    <footer className="border-t border-border/40 mt-24">
      <div className="mx-auto max-w-[1280px] px-6 py-10 grid gap-8 md:grid-cols-4 text-sm">
        <div>
          <div className="font-bold text-base">特挠率i额外</div>
          <p className="mt-2 text-muted-foreground">用一句话生成可运行的网页和应用。</p>
        </div>
        {[
          { t: "产品", l: ["功能", "案例", "价格", "更新日志"] },
          { t: "资源", l: ["文档", "教程", "社区", "博客"] },
          { t: "公司", l: ["关于我们", "联系", "条款", "隐私"] },
        ].map((c) => (
          <div key={c.t}>
            <div className="font-semibold">{c.t}</div>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              {c.l.map((x) => (
                <li key={x} className="hover:text-foreground cursor-pointer transition">{x}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border/40 py-5 text-center text-xs text-muted-foreground">
        © 2026 特挠率i额外 · 让创造更简单
      </div>
    </footer>
  );
}
