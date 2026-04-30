import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/fliggy/Header";
import { CategoryTabs } from "@/components/fliggy/CategoryTabs";
import { SearchPanel } from "@/components/fliggy/SearchPanel";
import { HeroBanner } from "@/components/fliggy/HeroBanner";
import { Recommendations } from "@/components/fliggy/Recommendations";
import { Footer } from "@/components/fliggy/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "飞猪旅行 — 机票、酒店、火车票、旅游度假在线预订" },
      {
        name: "description",
        content: "飞猪旅行：一站式预订机票、酒店、火车票、景点门票、跟团游与自由行，安心出行的在线旅游平台。",
      },
      { property: "og:title", content: "飞猪旅行 — 让旅行更简单" },
      { property: "og:description", content: "机票、酒店、火车票、景点门票一站式在线预订。" },
    ],
  }),
  component: Index,
});

function Index() {
  const [category, setCategory] = useState("flight");

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-hero)" }}>
      <Header />

      <main className="mx-auto max-w-[1200px] px-6">
        <h1 className="sr-only">飞猪旅行 — 在线旅游预订平台</h1>

        <div className="mt-2">
          <CategoryTabs active={category} onChange={setCategory} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[460px_1fr]">
          <SearchPanel category={category} />
          <HeroBanner />
        </div>
      </main>

      <Recommendations />
      <Footer />
    </div>
  );
}
