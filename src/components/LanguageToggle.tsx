import { useI18n } from "@/lib/i18n";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  const isZh = lang === "zh";
  return (
    <div
      role="group"
      aria-label={t("lang.toggle.title")}
      title={t("lang.toggle.title")}
      className={`inline-flex items-center rounded-full border border-border bg-background/60 backdrop-blur p-0.5 text-xs font-medium ${className}`}
    >
      <button
        type="button"
        onClick={() => setLang("zh")}
        aria-pressed={isZh}
        className={`px-3 py-1 rounded-full transition ${
          isZh ? "btn-brand" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        中文
      </button>
      <button
        type="button"
        onClick={() => setLang("en")}
        aria-pressed={!isZh}
        className={`px-3 py-1 rounded-full transition ${
          !isZh ? "btn-brand" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        EN
      </button>
    </div>
  );
}
