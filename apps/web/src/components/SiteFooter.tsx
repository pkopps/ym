"use client";

import { addLocalePrefix, TranslationKey } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";

const footerColumns: Array<{
  titleKey: TranslationKey;
  links: Array<{ href: string; labelKey: TranslationKey }>;
}> = [
  {
    titleKey: "footer.brand_title",
    links: [
      { href: "/", labelKey: "nav.home" },
      { href: "/about", labelKey: "nav.about" },
      { href: "/barnegat-nj", labelKey: "nav.launch_area_overview" },
      { href: "/customer", labelKey: "nav.book_service" },
      { href: "/help", labelKey: "nav.help" }
    ]
  },
  {
    titleKey: "footer.column.discover",
    links: [
      { href: "/services/lawn-mowing", labelKey: "service.category.lawn_mowing" },
      { href: "/services/yard-cleanup", labelKey: "service.category.seasonal_cleanup" },
      { href: "/barnegat-nj/lawn-mowing", labelKey: "nav.core_recurring_service" },
      { href: "/barnegat-nj/yard-cleanup", labelKey: "nav.core_reset_service" },
      { href: "/provider", labelKey: "nav.business_resources" },
      { href: "/crew", labelKey: "nav.crew_hiring" }
    ]
  },
  {
    titleKey: "footer.column.grow",
    links: [
      { href: "/provider", labelKey: "nav.for_providers" },
      { href: "/auth/provider/create", labelKey: "nav.list_business" },
      { href: "/crew", labelKey: "nav.find_crew_members" },
      { href: "/provider", labelKey: "nav.provider_growth_tools" },
      { href: "/about", labelKey: "nav.how_marketplace_works" },
      { href: "/help", labelKey: "nav.support_help_center" }
    ]
  },
  {
    titleKey: "footer.column.launch",
    links: [
      { href: "/barnegat-nj", labelKey: "nav.launch_area_overview" },
      { href: "/services/lawn-mowing", labelKey: "nav.core_recurring_service" },
      { href: "/services/yard-cleanup", labelKey: "nav.core_reset_service" },
      { href: "/customer", labelKey: "nav.recommendation_first_booking" },
      { href: "/about", labelKey: "nav.managed_marketplace" },
      { href: "/provider", labelKey: "nav.provider_marketplace_story" }
    ]
  },
  {
    titleKey: "footer.column.trust",
    links: [
      { href: "/support", labelKey: "nav.trust.support_expectations" },
      { href: "/cancellation-policy", labelKey: "nav.trust.cancellation_policy" },
      { href: "/refund-policy", labelKey: "nav.trust.refund_policy" },
      { href: "/booking-expectations", labelKey: "nav.trust.booking_expectations" },
      { href: "/provider-verification", labelKey: "nav.trust.provider_verification" },
      { href: "/privacy-policy", labelKey: "footer.legal.privacy" },
      { href: "/terms-of-service", labelKey: "footer.legal.terms" },
      { href: "/provider-standards", labelKey: "nav.trust.provider_standards" },
      { href: "/help", labelKey: "nav.help_center" }
    ]
  }
];

const socialLinks = [
  { href: "https://instagram.com", icon: "instagram", labelKey: "footer.social.instagram" },
  { href: "https://linkedin.com", icon: "linkedin", labelKey: "footer.social.linkedin" },
  { href: "https://facebook.com", icon: "facebook", labelKey: "footer.social.facebook" },
  { href: "https://x.com", icon: "x", labelKey: "footer.social.x" }
] as const;

function SocialIcon({ icon }: { icon: (typeof socialLinks)[number]["icon"] }) {
  if (icon === "instagram") {
    return (
      <svg aria-hidden="true" className="site-footer__social-icon" viewBox="0 0 24 24">
        <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="5.25" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="4.1" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.4" cy="6.6" r="1.2" fill="currentColor" />
      </svg>
    );
  }

  if (icon === "linkedin") {
    return (
      <svg aria-hidden="true" className="site-footer__social-icon" viewBox="0 0 24 24">
        <path
          d="M7.3 9.2V19H4.1V9.2H7.3ZM7.5 6.2C7.5 7.2 6.8 7.9 5.7 7.9C4.6 7.9 3.9 7.2 3.9 6.2C3.9 5.2 4.6 4.5 5.7 4.5C6.8 4.5 7.5 5.2 7.5 6.2ZM20.1 12.8V19H16.9V13.2C16.9 11.8 16.4 10.8 15.1 10.8C14.1 10.8 13.5 11.5 13.2 12.1C13.1 12.4 13.1 12.7 13.1 13V19H9.9C9.9 15.7 9.9 10.7 9.9 9.2H13.1V10.6C13.5 9.9 14.3 8.9 16.2 8.9C18.5 8.9 20.1 10.4 20.1 13.6V12.8Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (icon === "facebook") {
    return (
      <svg aria-hidden="true" className="site-footer__social-icon" viewBox="0 0 24 24">
        <path
          d="M13.8 19V12.8H15.9L16.2 10.3H13.8V8.7C13.8 7.9 14 7.3 15.2 7.3H16.3V5.1C15.8 5 15.2 5 14.7 5C12.4 5 10.9 6.4 10.9 9V10.3H9V12.8H10.9V19H13.8Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="site-footer__social-icon" viewBox="0 0 24 24">
      <path
        d="M6.2 5H9.3L12.1 9L15.1 5H18.1L13.5 11L18.4 19H15.2L12 14.2L8.4 19H5.4L10.6 12.1L6.2 5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function SiteFooter() {
  const i18n = useI18n();
  const localizedHref = (href: string) => addLocalePrefix(href, i18n.locale);

  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div className="site-footer__grid">
          {footerColumns.map((column) => (
            <section className="site-footer__column" key={column.titleKey}>
              <h2>{i18n.t(column.titleKey)}</h2>
              <ul>
                {column.links.map((link) => (
                  <li key={`${link.href}-${link.labelKey}`}>
                    <a href={localizedHref(link.href)}>{i18n.t(link.labelKey)}</a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="site-footer__bottom">
          <div className="site-footer__legal">
            <p>
              {i18n.t("footer.disclaimer")}
            </p>
            <div className="site-footer__meta">
              <span>{i18n.t("footer.copyright", { year: "2026" })}</span>
              <a href={localizedHref("/about")}>{i18n.t("footer.legal.about")}</a>
              <a href={localizedHref("/help")}>{i18n.t("footer.legal.help")}</a>
              <a href={localizedHref("/support")}>{i18n.t("footer.legal.support")}</a>
              <a href={localizedHref("/refund-policy")}>{i18n.t("footer.legal.refunds")}</a>
              <a href={localizedHref("/privacy-policy")}>{i18n.t("footer.legal.privacy")}</a>
              <a href={localizedHref("/terms-of-service")}>{i18n.t("footer.legal.terms")}</a>
              <a href={localizedHref("/barnegat-nj")}>{i18n.t("footer.legal.launch_area")}</a>
              <a href={localizedHref("/provider")}>{i18n.t("footer.legal.for_providers")}</a>
            </div>
          </div>

          <div className="site-footer__social" aria-label={i18n.t("footer.social_label")}>
            {socialLinks.map((link) => (
              <a
                aria-label={i18n.t(link.labelKey)}
                className="site-footer__social-badge"
                href={link.href}
                key={link.icon}
                rel="noreferrer"
                target="_blank"
              >
                <SocialIcon icon={link.icon} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
