import { MapPin } from "lucide-react";
import heroImg from "@/assets/hero-island.jpg";

export function HeroBanner() {
  return (
    <div className="relative h-full min-h-[440px] overflow-hidden rounded-3xl shadow-[var(--shadow-card)]">
      <img
        src={heroImg}
        alt="海岛旅行"
        width={1280}
        height={1280}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

      {/* Date pill */}
      <div className="absolute right-8 top-8 text-right text-white">
        <div className="text-7xl font-bold leading-none drop-shadow-lg">30</div>
        <div className="mt-3 inline-block rounded-full border border-white/60 bg-white/10 px-4 py-1 text-sm backdrop-blur-md">
          2026.04
        </div>
      </div>

      {/* Caption */}
      <div className="absolute bottom-8 left-8 right-8 text-white">
        <h2 className="text-2xl font-bold drop-shadow-lg">海把天空也染成了蓝色</h2>
        <div className="mt-3 flex items-center gap-1.5 text-sm text-white/90">
          <MapPin className="h-4 w-4" />
          中国 · 阳江 · 马尾岛
        </div>
      </div>
    </div>
  );
}
