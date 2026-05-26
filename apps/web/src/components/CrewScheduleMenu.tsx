"use client";

import { usePathname } from "next/navigation";

const crewScheduleLinks = [
  { href: "/crew/schedule", label: "Upcoming schedule" },
  { href: "/crew/schedule/history", label: "Past job history" }
] as const;

export function CrewScheduleMenu() {
  const pathname = usePathname();

  return (
    <details className="crew-menu">
      <summary className="crew-menu__summary" aria-label="Crew schedule menu">
        <span className="crew-menu__icon" aria-hidden="true">
          ≡
        </span>
        <span>Menu</span>
      </summary>
      <div className="crew-menu__panel">
        {crewScheduleLinks.map((link) => (
          <a
            className={pathname === link.href ? "crew-menu__link crew-menu__link--active" : "crew-menu__link"}
            href={link.href}
            key={link.href}
          >
            {link.label}
          </a>
        ))}
      </div>
    </details>
  );
}
