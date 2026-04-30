export function Footer() {
  return (
    <footer className="mt-20 border-t border-border/60 bg-white/40">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-6 py-10 md:grid-cols-4">
        {[
          { t: "新手指南", l: ["注册新用户", "支付方式", "常见问题"] },
          { t: "服务保障", l: ["退改保障", "出行无忧", "理赔申请"] },
          { t: "商家合作", l: ["商家入驻", "品牌合作", "广告投放"] },
          { t: "关于飞猪", l: ["关于我们", "联系我们", "加入我们"] },
        ].map((c) => (
          <div key={c.t}>
            <div className="font-semibold text-foreground">{c.t}</div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {c.l.map((x) => (
                <li key={x} className="hover:text-brand-orange cursor-pointer transition">{x}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border/60 py-5 text-center text-xs text-muted-foreground">
        © 2026 飞猪旅行 · 让旅行更简单
      </div>
    </footer>
  );
}
