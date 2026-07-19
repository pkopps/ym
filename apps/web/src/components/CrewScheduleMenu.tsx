"use client";

import { addLocalePrefix, stripLocalePrefix, type TranslationKey } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { usePathname } from "next/navigation";

const crewScheduleLinks = [
  { href: "/crew/schedule", labelKey: "crew_schedule.menu.upcoming" },
  { href: "/crew/schedule/history", labelKey: "crew_schedule.menu.history" }
] satisfies Array<{ href: string; labelKey: TranslationKey }>;

export function CrewScheduleMenu() {
  const i18n = useI18n();
  const pathname = usePathname();
  const activePathname = stripLocalePrefix(pathname).path;

  return (
    <details className="crew-menu">
      <summary className="crew-menu__summary" aria-label={i18n.t("crew_schedule.menu.aria")}>
        <span className="crew-menu__icon" aria-hidden="true">
          ≡
        </span>
        <span>{i18n.t("crew_schedule.menu.label")}</span>
      </summary>
      <div className="crew-menu__panel">
        {crewScheduleLinks.map((link) => (
          <a
            className={activePathname === link.href ? "crew-menu__link crew-menu__link--active" : "crew-menu__link"}
            href={addLocalePrefix(link.href, i18n.locale)}
            key={link.href}
          >
            {i18n.t(link.labelKey)}
          </a>
        ))}
      </div>
    </details>
  );
}
