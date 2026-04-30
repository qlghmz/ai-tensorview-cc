import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/fliggy/Header";
import { Footer } from "@/components/fliggy/Footer";
import { Plane, Building2, Train, Calendar, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "我的订单 — 飞猪旅行" },
      { name: "description", content: "查看和管理您的机票、酒店、火车票订单。" },
    ],
  }),
  component: OrdersPage,
});

const TABS = ["全部", "待付款", "待出行", "已完成", "已取消"];

const ORDERS = [
  {
    type: "酒店",
    icon: Building2,
    color: "var(--gradient-card-hotel)",
    title: "三亚亚特兰蒂斯度假酒店 · 豪华大床房",
    info: "2026-04-30 入住 · 2 晚 · 1 间",
    status: "待出行",
    statusColor: "text-brand-orange",
    price: 5760,
  },
  {
    type: "机票",
    icon: Plane,
    color: "var(--gradient-card-air)",
    title: "上海虹桥 → 三亚凤凰 · 东方航空 MU5305",
    info: "2026-04-30 08:30 起飞 · 经济舱",
    status: "待出行",
    statusColor: "text-brand-orange",
    price: 1280,
  },
  {
    type: "火车票",
    icon: Train,
    color: "var(--gradient-card-train)",
    title: "北京南 → 上海虹桥 · G103",
    info: "2026-03-15 09:00 出发 · 二等座",
    status: "已完成",
    statusColor: "text-muted-foreground",
    price: 553,
  },
  {
    type: "酒店",
    icon: Building2,
    color: "var(--gradient-card-hotel)",
    title: "九寨沟天堂洲际大饭店 · 标准间",
    info: "2026-02-10 入住 · 3 晚",
    status: "已完成",
    statusColor: "text-muted-foreground",
    price: 3840,
  },
];

function OrdersPage() {
  const [tab, setTab] = useState("全部");
  const list = tab === "全部" ? ORDERS : ORDERS.filter((o) => o.status === tab);

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-hero)" }}>
      <Header />

      <div className="mx-auto max-w-[1200px] px-6 py-6">
        <div className="flex items-center gap-3">
          <Link to="/profile" className="text-sm text-muted-foreground hover:text-brand-orange">个人中心</Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">我的订单</span>
        </div>

        <h1 className="mt-3 text-2xl font-bold">我的订单</h1>

        <div className="mt-5 rounded-2xl bg-white p-2 shadow-[var(--shadow-soft)] inline-flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                tab === t ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-4">
          {list.length === 0 ? (
            <div className="rounded-2xl bg-white p-12 text-center text-muted-foreground shadow-[var(--shadow-soft)]">
              暂无相关订单
            </div>
          ) : (
            list.map((o, i) => {
              const Icon = o.icon;
              return (
                <div key={i} className="rounded-2xl bg-white p-5 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-card)] transition">
                  <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-md text-white"
                        style={{ background: o.color }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-sm font-medium">{o.type}订单</span>
                      <span className="text-xs text-muted-foreground">订单号：FL{(202604000000 + i).toString()}</span>
                    </div>
                    <span className={`text-sm font-semibold ${o.statusColor}`}>{o.status}</span>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold">{o.title}</div>
                      <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" /> {o.info}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[color:var(--price)]">¥{o.price.toLocaleString()}</div>
                      <div className="mt-2 flex gap-2 justify-end">
                        <button className="rounded-full border border-border px-4 py-1.5 text-xs hover:border-brand-orange hover:text-brand-orange transition">
                          查看详情
                        </button>
                        {o.status === "待出行" && (
                          <button className="rounded-full bg-foreground text-background px-4 py-1.5 text-xs hover:bg-foreground/85 transition">
                            行程助手
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
