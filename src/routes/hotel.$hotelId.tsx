import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/fliggy/Header";
import { Footer } from "@/components/fliggy/Footer";
import { Star, MapPin, Wifi, Car, Coffee, Waves, Dumbbell, ShieldCheck, ChevronRight } from "lucide-react";
import sanya from "@/assets/dest-sanya.jpg";
import jiuzhai from "@/assets/dest-jiuzhaigou.jpg";
import disney from "@/assets/dest-disney.jpg";
import greatwall from "@/assets/dest-greatwall.jpg";
import jeju from "@/assets/dest-jeju.jpg";
import universal from "@/assets/dest-universal.jpg";

const HOTELS: Record<string, { name: string; img: string; area: string; score: number; reviews: number; address: string }> = {
  "1": { name: "三亚亚特兰蒂斯度假酒店", img: sanya, area: "海棠湾", score: 4.9, reviews: 12480, address: "海南省三亚市海棠区海棠北路 36 号" },
  "2": { name: "九寨沟天堂洲际大饭店", img: jiuzhai, area: "九寨沟景区", score: 4.8, reviews: 5621, address: "四川省阿坝州九寨沟县漳扎镇" },
  "3": { name: "上海迪士尼乐园酒店", img: disney, area: "浦东新区", score: 4.7, reviews: 28392, address: "上海市浦东新区申迪西路 310 号" },
  "4": { name: "北京古北水镇长城别墅", img: greatwall, area: "密云区", score: 4.9, reviews: 3421, address: "北京市密云区古北口镇" },
  "5": { name: "济州岛海景公寓酒店", img: jeju, area: "济州市", score: 4.6, reviews: 1890, address: "韩国济州特别自治道济州市" },
  "6": { name: "北京环球影城大酒店", img: universal, area: "通州区", score: 4.8, reviews: 9123, address: "北京市通州区文化旅游区" },
};

const ROOMS = [
  { type: "豪华大床房", bed: "1.8m 大床", area: "45㎡", view: "海景", price: 2880, breakfast: true },
  { type: "高级双床房", bed: "2 张 1.2m 床", area: "42㎡", view: "园景", price: 2380, breakfast: true },
  { type: "亲子主题套房", bed: "1 大 1 小床", area: "65㎡", view: "海景", price: 4280, breakfast: true },
  { type: "豪华行政套房", bed: "1.8m 大床", area: "85㎡", view: "全海景", price: 5680, breakfast: true },
];

export const Route = createFileRoute("/hotel/$hotelId")({
  head: ({ params }) => {
    const h = HOTELS[params.hotelId] ?? HOTELS["1"];
    return {
      meta: [
        { title: `${h.name} — 飞猪旅行` },
        { name: "description", content: `${h.name}（${h.area}）— 在飞猪旅行查看房型、价格与评价，享会员立减优惠。` },
        { property: "og:title", content: h.name },
        { property: "og:image", content: h.img },
      ],
    };
  },
  component: HotelPage,
});

function HotelPage() {
  const { hotelId } = Route.useParams();
  const h = HOTELS[hotelId] ?? HOTELS["1"];

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-hero)" }}>
      <Header />

      <div className="mx-auto max-w-[1200px] px-6 py-4">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-4 flex items-center gap-1">
          <Link to="/" className="hover:text-brand-orange">首页</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/search" className="hover:text-brand-orange">酒店</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground">{h.name}</span>
        </nav>

        {/* Gallery + summary */}
        <div className="grid lg:grid-cols-[1fr_380px] gap-5">
          <div className="rounded-3xl overflow-hidden">
            <img src={h.img} alt={h.name} className="h-[420px] w-full object-cover" />
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-[var(--shadow-card)] flex flex-col">
            <h1 className="text-2xl font-bold">{h.name}</h1>
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" /> {h.address}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="rounded-xl bg-brand-yellow/30 px-3 py-2">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-brand-yellow-deep text-brand-yellow-deep" />
                  <span className="text-xl font-bold">{h.score}</span>
                </div>
                <div className="text-xs text-muted-foreground">超棒</div>
              </div>
              <div className="text-sm text-muted-foreground">基于 {h.reviews.toLocaleString()} 条真实点评</div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              {[
                { i: <Wifi className="h-4 w-4" />, l: "WiFi" },
                { i: <Car className="h-4 w-4" />, l: "停车" },
                { i: <Coffee className="h-4 w-4" />, l: "早餐" },
                { i: <Waves className="h-4 w-4" />, l: "泳池" },
                { i: <Dumbbell className="h-4 w-4" />, l: "健身" },
                { i: <ShieldCheck className="h-4 w-4" />, l: "安心" },
              ].map((x) => (
                <div key={x.l} className="rounded-xl bg-muted/40 py-2 flex flex-col items-center gap-1 text-xs text-muted-foreground">
                  {x.i}
                  {x.l}
                </div>
              ))}
            </div>

            <div className="mt-auto pt-5 border-t border-border/60 flex items-end justify-between">
              <div>
                <div className="text-xs text-muted-foreground">每晚低至</div>
                <div className="text-2xl font-bold text-[color:var(--price)]">¥2880<span className="text-xs font-normal text-muted-foreground ml-1">起</span></div>
              </div>
              <a href="#rooms" className="rounded-full px-6 py-2.5 text-sm font-semibold text-foreground shadow-[var(--shadow-glow)] hover:scale-[1.02] transition" style={{ background: "var(--gradient-pill)" }}>
                选择房型
              </a>
            </div>
          </div>
        </div>

        {/* Rooms */}
        <section id="rooms" className="mt-8">
          <h2 className="text-xl font-bold mb-4">可订房型</h2>
          <div className="rounded-3xl bg-white shadow-[var(--shadow-soft)] overflow-hidden">
            {ROOMS.map((r, i) => (
              <div
                key={r.type}
                className={`grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-4 px-6 py-5 items-center ${
                  i !== ROOMS.length - 1 ? "border-b border-border/60" : ""
                }`}
              >
                <div>
                  <div className="font-semibold">{r.type}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{r.area} · {r.view}</div>
                </div>
                <div className="text-sm text-muted-foreground">{r.bed}</div>
                <div className="text-sm flex flex-wrap gap-2">
                  <span className="rounded bg-brand-yellow/30 text-brand-orange px-2 py-0.5 text-xs">含双早</span>
                  <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">免费取消</span>
                </div>
                <div className="flex items-center gap-3 justify-end">
                  <div className="text-right">
                    <div className="text-xl font-bold text-[color:var(--price)]">¥{r.price}</div>
                    <div className="text-[10px] text-muted-foreground">含税费</div>
                  </div>
                  <button className="rounded-full bg-foreground text-background px-5 py-2 text-sm hover:bg-foreground/85 transition">
                    预订
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Reviews */}
        <section className="mt-8">
          <h2 className="text-xl font-bold mb-4">用户评价</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { u: "小鱼儿", c: "海景房视野超棒，早餐种类丰富，孩子玩得很开心！", s: 5 },
              { u: "旅行达人", c: "服务一流，前台办理迅速，房间设施新。", s: 5 },
              { u: "Lucy", c: "位置不错，性价比高，会再来住。", s: 4 },
              { u: "阿明", c: "泳池干净，早餐稍微拥挤，整体满意。", s: 4 },
            ].map((r) => (
              <div key={r.u} className="rounded-2xl bg-white p-5 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{r.u}</div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: r.s }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-brand-yellow-deep text-brand-yellow-deep" />
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{r.c}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}
