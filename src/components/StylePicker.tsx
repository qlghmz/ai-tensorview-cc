import { UI_STYLE_PRESETS } from "@/lib/ui-styles";

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  lang?: "zh" | "en";
  compact?: boolean;
}

export function StylePicker({ value, onChange, lang = "zh", compact }: Props) {
  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "" : "mt-2"}`}>
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`rounded-full px-3 py-1 text-xs border transition ${
          !value ? "btn-brand border-transparent" : "glass text-muted-foreground hover:text-foreground"
        }`}
      >
        {lang === "zh" ? "默认" : "Default"}
      </button>
      {UI_STYLE_PRESETS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(s.id)}
          className={`rounded-full px-3 py-1 text-xs border transition ${
            value === s.id ? "btn-brand border-transparent" : "glass text-muted-foreground hover:text-foreground"
          }`}
          title={lang === "zh" ? s.label : s.labelEn}
        >
          {s.emoji} {lang === "zh" ? s.label : s.labelEn}
        </button>
      ))}
    </div>
  );
}
