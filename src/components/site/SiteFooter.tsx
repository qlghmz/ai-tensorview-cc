import { Link } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n-dict";

type Item = { k: DictKey; href?: string; to?: "/pricing" | "/docs" | "/auth" };

export function SiteFooter() {
  const t = useT();
  const groups: { k: DictKey; items: Item[] }[] = [
    {
      k: "footer.group.product",
      items: [
        { k: "footer.item.features", href: "/#features" },
        { k: "footer.item.showcase", href: "/#showcase" },
        { k: "footer.item.pricing", to: "/pricing" },
        { k: "footer.item.changelog", href: "#" },
      ],
    },
    {
      k: "footer.group.resources",
      items: [
        { k: "footer.item.docs", to: "/docs" },
        { k: "footer.item.tutorials", href: "#" },
        { k: "footer.item.community", href: "#" },
        { k: "footer.item.blog", href: "#" },
      ],
    },
    {
      k: "footer.group.company",
      items: [
        { k: "footer.item.about", href: "#" },
        { k: "footer.item.contact", href: "mailto:support@tensorview.cc" },
        { k: "footer.item.terms", href: "#" },
        { k: "footer.item.privacy", href: "#" },
      ],
    },
  ];

  return (
    <footer className="border-t border-border/40 mt-24">
      <div className="mx-auto max-w-[1280px] px-6 py-10 grid gap-8 md:grid-cols-4 text-sm">
        <div>
          <div className="font-bold text-base">TensorView</div>
          <p className="mt-2 text-muted-foreground">{t("footer.tagline")}</p>
        </div>
        {groups.map((c) => (
          <div key={c.k}>
            <div className="font-semibold">{t(c.k)}</div>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              {c.items.map((x) => (
                <li key={x.k}>
                  {x.to ? (
                    <Link to={x.to} className="hover:text-foreground transition">{t(x.k)}</Link>
                  ) : (
                    <a href={x.href ?? "#"} className="hover:text-foreground transition">{t(x.k)}</a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border/40 py-5 text-center text-xs text-muted-foreground">
        {t("footer.copyright")}
      </div>
    </footer>
  );
}
