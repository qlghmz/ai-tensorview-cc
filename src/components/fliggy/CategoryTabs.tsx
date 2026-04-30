import { Plane, Building2, Train, Palmtree, Ticket, Briefcase } from "lucide-react";
import { useState } from "react";

const categories = [
  { key: "flight", label: "机票", icon: Plane, gradient: "var(--gradient-card-air)" },
  { key: "hotel", label: "酒店", icon: Building2, gradient: "var(--gradient-card-hotel)" },
  { key: "train", label: "火车票", icon: Train, gradient: "var(--gradient-card-train)" },
  { key: "tour", label: "旅游度假", icon: Palmtree, gradient: "var(--gradient-card-tour)" },
  { key: "ticket", label: "景点门票", icon: Ticket, gradient: "var(--gradient-card-ticket)" },
  { key: "biz", label: "阿里商旅", icon: Briefcase, gradient: "var(--gradient-card-biz)" },
];

interface Props {
  active: string;
  onChange: (key: string) => void;
}

export function CategoryTabs({ active, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {categories.map((c) => {
        const Icon = c.icon;
        const isActive = active === c.key;
        return (
          <button
            key={c.key}
            onClick={() => onChange(c.key)}
            className={`group flex items-center gap-3 rounded-full pl-1.5 pr-6 py-1.5 transition-[var(--transition-smooth)] ${
              isActive
                ? "bg-white shadow-[var(--shadow-card)] scale-[1.03]"
                : "bg-white/60 hover:bg-white hover:shadow-[var(--shadow-soft)]"
            }`}
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-[var(--shadow-soft)]"
              style={{ background: c.gradient }}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className={`text-base font-semibold ${isActive ? "text-foreground" : "text-foreground/75"}`}>
              {c.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export const categoryKeys = categories.map((c) => c.key);
