"use client";

import { addLocalePrefix, stripLocalePrefix, TranslationKey } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { usePathname } from "next/navigation";

const footerLinks: Array<{ href: string; labelKey: TranslationKey }> = [
  { href: "/services/lawn-mowing", labelKey: "service.category.lawn_mowing" },
  { href: "/services/yard-cleanup", labelKey: "service.category.seasonal_cleanup" },
  { href: "/help", labelKey: "footer.legal.help" },
  { href: "/refund-policy", labelKey: "footer.legal.refunds" },
  { href: "/privacy-policy", labelKey: "footer.legal.privacy" },
  { href: "/terms-of-service", labelKey: "footer.legal.terms" }
];

export function SiteFooter() {
  const i18n = useI18n();
  const pathname = stripLocalePrefix(usePathname()).path;
  const links = pathname === "/" ? footerLinks : footerLinks.slice(2);

  return (
    <footer className="compact-footer">
      <div className="container">
        <span>{i18n.t("footer.copyright", { year: "2026" })}</span>
        <nav>
          {links.map((link) => (
            <a href={addLocalePrefix(link.href, i18n.locale)} key={link.href}>
              {i18n.t(link.labelKey)}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
