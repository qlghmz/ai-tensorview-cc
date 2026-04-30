import { useState } from "react";
import { ArrowLeftRight, Calendar, ShieldCheck, Plane } from "lucide-react";

const tabs = ["国内", "国际/中国港澳台"];

export function SearchPanel({ category }: { category: string }) {
  const [tab, setTab] = useState(0);
  const [trip, setTrip] = useState<"oneway" | "roundtrip">("oneway");

  const ctaLabel: Record<string, string> = {
    flight: "搜索机票",
    hotel: "搜索酒店",
    train: "搜索火车票",
    tour: "搜索度假",
    ticket: "搜索门票",
    biz: "进入商旅",
  };

  return (
    <div className="rounded-3xl bg-white p-7 shadow-[var(--shadow-card)]">
      {/* Tabs */}
      <div className="flex items-center gap-7 border-b border-border/60 pb-3">
        {tabs.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`relative pb-1 text-base font-semibold transition ${
              tab === i ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
            {tab === i && (
              <span className="absolute -bottom-[14px] left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-brand-orange" />
            )}
          </button>
        ))}
      </div>

      {/* Trip type (only for flight/train) */}
      {(category === "flight" || category === "train") && (
        <div className="mt-5 flex items-center gap-6">
          {[
            { v: "oneway", label: "单程" },
            { v: "roundtrip", label: "往返" },
          ].map((o) => (
            <label key={o.v} className="flex cursor-pointer items-center gap-2 text-sm">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition ${
                  trip === o.v ? "border-brand-orange bg-brand-orange" : "border-muted-foreground/30"
                }`}
              >
                {trip === o.v && <span className="h-2 w-2 rounded-full bg-white" />}
              </span>
              <span className="text-foreground/85">{o.label}</span>
            </label>
          ))}
        </div>
      )}

      {/* From / To */}
      <div className="mt-5 grid grid-cols-2 items-center rounded-2xl bg-secondary/60 p-5 relative">
        <div>
          <div className="text-xs text-muted-foreground">出发城市</div>
          <div className="mt-1 text-3xl font-bold text-foreground">北京</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">到达城市</div>
          <div className="mt-1 text-3xl font-bold text-foreground">杭州</div>
        </div>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[var(--shadow-soft)] hover:rotate-180 transition-transform duration-300">
            <ArrowLeftRight className="h-4 w-4 text-brand-orange" />
          </button>
        </div>
      </div>

      {/* Dates */}
      <div className="mt-3 grid grid-cols-2 items-center rounded-2xl bg-secondary/60 p-5">
        <div>
          <div className="text-xs text-muted-foreground">出发日期</div>
          <div className="mt-1 text-xl font-semibold text-foreground">2026-05-01</div>
        </div>
        <div className="flex items-center justify-end gap-2 text-muted-foreground text-sm">
          <Calendar className="h-4 w-4" />
          <span>请选择日期</span>
        </div>
      </div>

      {/* CTA */}
      <button className="mt-7 w-full rounded-full bg-gradient-to-r from-brand-yellow to-brand-yellow-deep py-4 text-lg font-bold text-foreground shadow-[var(--shadow-glow)] hover:scale-[1.01] transition-[var(--transition-smooth)] flex items-center justify-center gap-2">
        <Plane className="h-5 w-5" />
        {ctaLabel[category] ?? "搜索"}
      </button>

      {/* Trust */}
      <div className="mt-4 flex items-center justify-center gap-5 text-xs text-muted-foreground">
        {["安心票", "出票安心", "出行安心", "服务安心"].map((t) => (
          <span key={t} className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-orange" />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
