import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/fliggy/Header";
import { Footer } from "@/components/fliggy/Footer";
import { Star, MapPin, Wifi, Car, Coffee, Filter } from "lucide-react";
import sanya from "@/assets/dest-sanya.jpg";
import jiuzhai from "@/assets/dest-jiuzhaigou.jpg";
import disney from "@/assets/dest-disney.jpg";
import greatwall from "@/assets/dest-greatwall.jpg";
import jeju from "@/assets/dest-jeju.jpg";
import universal from "@/assets/dest-universal.jpg";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "酒店搜索结果 — 飞猪旅行" },
      { name: "description", content: "搜索全球优质酒店，比较价格、查看评价、轻松预订。" },
    ],
  }),
  component: SearchPage,
});

const HOTELS = [
  { id: "1", name: "三亚亚特兰蒂斯度假酒店", img: sanya, area: "海棠湾", score: 4.9, reviews: 12480, price: 2880, tag: "海景房 含双早" },
  { id: "2", name: "九寨沟天堂洲际大饭店", img: jiuzhai, area: "九寨沟景区", score: 4.8, reviews: 5621, price: 1280, tag: "免费取消" },
  { id: "3", name: "上海迪士尼乐园酒店", img: disney, area: "浦东新区", score: 4.7, reviews: 28392, price: 2188, tag: "含乐园门票" },
  { id: "4", name: "北京古北水镇长城别墅", img: greatwall, area: "密云区", score: 4.9, reviews: 3421, price: 1680, tag: "亲子套餐" },
  { id: "5", name: "济州岛海景公寓酒店", img: jeju, area: "济州市", score: 4.6, reviews: 1890, price: 980, tag: "落地窗海景" },
  { id: "6", name: "北京环球影城大酒店", img: universal, area: "通州区", score: 4.8, reviews: 9123, price: 2380, tag: "园区内 免排队" },
];

const FILTERS = [
  { t: "价格", o: ["¥0-300", "¥300-600", "¥600-1000", "¥1000+"] },
  { t: "星级", o: ["五星/豪华", "四星/高档", "三星/舒适", "经济型"] },
  { t: "品牌", o: ["亚特兰蒂斯", "洲际", "希尔顿", "万豪", "华住"] },
  { t: "设施", o: ["免费WiFi", "停车场", "游泳池", "健身房", "早餐"] },
];

function SearchPage() {
  const [sort, setSort] = useState("recommend");

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-hero)" }}>
      <Header />

      {/* Search summary */}
      <div className="border-y border-border/60 bg-white/70 backdrop-blur">
        <div className="mx-auto max-w-[1200px] px-6 py-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <MapPin className="h-5 w-5 text-brand-orange" /> 三亚
          </div>
          <span className="text-sm text-muted-foreground">入住 04-30 · 离店 05-02 · 共 2 晚</span>
          <span className="text-sm text-muted-foreground">2 位成人 · 1 间</span>
          <button className="ml-auto rounded-full bg-foreground text-background px-5 py-2 text-sm hover:bg-foreground/85 transition">
            重新搜索
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] px-6 py-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Filters */}
        <aside className="space-y-5">
          <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-2 mb-4 font-semibold">
              <Filter className="h-4 w-4 text-brand-orange" /> 筛选
            </div>
            {FILTERS.map((f) => (
              <div key={f.t} className="mb-4 last:mb-0">
                <div className="text-sm font-medium mb-2">{f.t}</div>
                <div className="flex flex-wrap gap-2">
                  {f.o.map((x) => (
                    <button
                      key={x}
                      className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground hover:border-brand-orange hover:text-brand-orange transition"
                    >
                      {x}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Results */}
        <section>
          <div className="flex items-center gap-2 mb-4 rounded-2xl bg-white p-2 shadow-[var(--shadow-soft)]">
            {[
              { k: "recommend", l: "推荐排序" },
              { k: "price", l: "价格最低" },
              { k: "score", l: "评分最高" },
              { k: "sales", l: "销量优先" },
            ].map((s) => (
              <button
                key={s.k}
                onClick={() => setSort(s.k)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  sort === s.k
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.l}
              </button>
            ))}
            <span className="ml-auto pr-3 text-sm text-muted-foreground">共找到 {HOTELS.length} 家酒店</span>
          </div>

          <div className="space-y-4">
            {HOTELS.map((h) => (
              <Link
                key={h.id}
                to="/hotel/$hotelId"
                params={{ hotelId: h.id }}
                className="block rounded-2xl bg-white p-4 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-card)] transition group"
              >
                <div className="flex flex-col sm:flex-row gap-4">
                  <img
                    src={h.img}
                    alt={h.name}
                    className="h-44 sm:h-36 sm:w-52 w-full rounded-xl object-cover group-hover:scale-[1.02] transition"
                  />
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold group-hover:text-brand-orange transition">{h.name}</h3>
                        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" /> {h.area}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <Star className="h-4 w-4 fill-brand-yellow-deep text-brand-yellow-deep" />
                          <span className="font-bold">{h.score}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{h.reviews.toLocaleString()} 条评价</div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Tag icon={<Wifi className="h-3 w-3" />} label="免费WiFi" />
                      <Tag icon={<Car className="h-3 w-3" />} label="停车场" />
                      <Tag icon={<Coffee className="h-3 w-3" />} label="含早餐" />
                    </div>

                    <div className="mt-auto flex items-end justify-between pt-3">
                      <span className="rounded-md bg-brand-yellow/30 px-2 py-1 text-xs text-brand-orange font-medium">
                        {h.tag}
                      </span>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">每晚低至</div>
                        <div className="text-2xl font-bold text-[color:var(--price)]">
                          ¥<span className="text-3xl">{h.price}</span>
                          <span className="text-xs font-normal text-muted-foreground ml-1">起</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}

function Tag({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
      {icon}
      {label}
    </span>
  );
}
