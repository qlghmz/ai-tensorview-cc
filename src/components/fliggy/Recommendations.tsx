import { Link } from "@tanstack/react-router";
import jiuzhai from "@/assets/dest-jiuzhaigou.jpg";
import disney from "@/assets/dest-disney.jpg";
import universal from "@/assets/dest-universal.jpg";
import jeju from "@/assets/dest-jeju.jpg";
import sanya from "@/assets/dest-sanya.jpg";
import greatwall from "@/assets/dest-greatwall.jpg";

const items = [
  { img: jiuzhai, title: "[九寨沟景区-大门票+观光车]", price: 274, sold: "8万+" },
  { img: disney, title: "[香港迪士尼乐园-1日门票（无需预约）] 电子票扫码入园可升级尊享", price: 490, sold: "2万+" },
  { img: universal, title: "[北京环球度假区-1日门票] 北京环球影城特惠票-免预约", price: 422, sold: "10万+" },
  { img: jeju, title: "韩国济州岛一日游 牛岛旅游一日游 包车拼车济州岛接送机", price: 98, sold: "6万+" },
  { img: sanya, title: "三亚亚特兰蒂斯水世界 1日门票 含失落的空间水族馆", price: 358, sold: "3万+" },
  { img: greatwall, title: "北京八达岭长城+故宫一日游 纯玩无购物 专车接送", price: 268, sold: "12万+" },
];

export function Recommendations() {
  return (
    <section className="mx-auto mt-16 max-w-[1200px] px-6">
      <div className="flex items-end justify-between">
        <h2 className="text-2xl font-bold text-foreground">为你推荐</h2>
        <Link to="/search" className="text-sm text-muted-foreground hover:text-brand-orange transition">
          查看更多 →
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-6">
        {items.map((item, i) => (
          <article
            key={i}
            className="group cursor-pointer overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-card)] hover:-translate-y-1 transition-[var(--transition-smooth)]"
          >
            <div className="aspect-square overflow-hidden">
              <img
                src={item.img}
                alt={item.title}
                width={400}
                height={400}
                loading="lazy"
                className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            </div>
            <div className="p-3">
              <p className="line-clamp-2 min-h-[2.5rem] text-xs leading-snug text-foreground/85">
                {item.title}
              </p>
              <div className="mt-2 flex items-end justify-between">
                <div className="flex items-baseline text-price">
                  <span className="text-xs">¥</span>
                  <span className="text-xl font-bold">{item.price}</span>
                  <span className="ml-0.5 text-[10px] text-muted-foreground">起</span>
                </div>
                <span className="text-[10px] text-muted-foreground">已售{item.sold}/件</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
