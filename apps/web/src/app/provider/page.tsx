import type { Metadata } from "next";
import { addLocalePrefix, type TranslationKey } from "@yardmatch/i18n";
import Link from "next/link";
import { getLocalizedPageMetadata, getRequestI18n } from "../../lib/i18n-server";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/provider",
    titleKey: "provider_landing.metadata.title",
    descriptionKey: "provider_landing.metadata.description"
  });
}

const benefits = [
  {
    titleKey: "provider_landing.benefits.matching.title",
    bodyKey: "provider_landing.benefits.matching.body"
  },
  {
    titleKey: "provider_landing.benefits.calendar.title",
    bodyKey: "provider_landing.benefits.calendar.body"
  },
  {
    titleKey: "provider_landing.benefits.repeat.title",
    bodyKey: "provider_landing.benefits.repeat.body"
  }
] satisfies Array<{ titleKey: TranslationKey; bodyKey: TranslationKey }>;

// Amounts mirror ACTIVE_FINDER_FEE_ECONOMICS_POLICY in packages/domain/src/finderFee.ts.
const priceRows = [
  {
    labelKey: "provider_landing.pricing.typical.label",
    priceKey: "provider_landing.pricing.typical.price"
  },
  {
    labelKey: "provider_landing.pricing.large.label",
    priceKey: "provider_landing.pricing.large.price"
  },
  {
    labelKey: "provider_landing.pricing.very_large.label",
    priceKey: "provider_landing.pricing.very_large.price"
  },
  {
    labelKey: "provider_landing.pricing.first_customer.label",
    priceKey: "provider_landing.pricing.first_customer.price"
  },
  {
    labelKey: "provider_landing.pricing.per_job.label",
    priceKey: "provider_landing.pricing.per_job.price"
  },
  {
    labelKey: "provider_landing.pricing.pro.label",
    priceKey: "provider_landing.pricing.pro.price"
  },
  {
    labelKey: "provider_landing.pricing.teams.label",
    priceKey: "provider_landing.pricing.teams.price"
  }
] satisfies Array<{ labelKey: TranslationKey; priceKey: TranslationKey }>;

export default async function ProviderPage() {
  const i18n = await getRequestI18n();
  const href = (path: string) => addLocalePrefix(path, i18n.locale);
  const signUpHref = href("/auth/provider/create");

  return (
    <main className="provider-landing">
      <section className="container provider-landing__hero">
        <h1>{i18n.t("provider_landing.hero.title")}</h1>
        <p>{i18n.t("provider_landing.hero.body")}</p>
        <a className="button" href={signUpHref}>
          {i18n.t("provider_landing.signup_cta")}
        </a>
      </section>

      <section className="container provider-landing__section" aria-labelledby="provider-landing-benefits">
        <h2 id="provider-landing-benefits">{i18n.t("provider_landing.benefits.title")}</h2>
        <ul className="provider-landing__benefits">
          {benefits.map((benefit) => (
            <li key={benefit.titleKey}>
              <h3>{i18n.t(benefit.titleKey)}</h3>
              <p>{i18n.t(benefit.bodyKey)}</p>
            </li>
          ))}
        </ul>
        <Link className="provider-landing__link" id="requirements" href={href("/provider-standards")}>
          {i18n.t("provider_landing.standards.link")}
        </Link>
      </section>

      <section className="container provider-landing__section" id="pricing" aria-labelledby="provider-landing-pricing">
        <h2 id="provider-landing-pricing">{i18n.t("provider_landing.pricing.title")}</h2>
        <p>{i18n.t("provider_landing.pricing.body")}</p>
        <dl className="provider-landing__prices">
          {priceRows.map((row) => (
            <div key={row.labelKey}>
              <dt>{i18n.t(row.labelKey)}</dt>
              <dd>{i18n.t(row.priceKey)}</dd>
            </div>
          ))}
        </dl>
        <p className="provider-landing__note">{i18n.t("provider_landing.pricing.plans_note")}</p>
        <a className="button-secondary" href={signUpHref}>
          {i18n.t("provider_landing.signup_cta")}
        </a>
      </section>

      <section className="container provider-landing__section" aria-labelledby="provider-landing-closing">
        <div className="panel provider-landing__closing">
          <h2 id="provider-landing-closing">{i18n.t("provider_landing.final.title")}</h2>
          <a className="button" href={signUpHref}>
            {i18n.t("provider_landing.signup_cta")}
          </a>
        </div>
      </section>
    </main>
  );
}
