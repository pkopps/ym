import Link from "next/link";
import type { Metadata } from "next";
import { addLocalePrefix, type TranslationKey } from "@yardmatch/i18n";
import { LaunchLeadCaptureCard } from "../../components/LaunchLeadCaptureCard";
import { LaunchMarketplaceProofSection } from "../../components/LaunchMarketplaceProofSection";
import { getLocalizedPageMetadata, getRequestI18n } from "../../lib/i18n-server";
import {
  launchAreaLabel,
  launchAreaShortLabel,
  launchServiceContent
} from "../../lib/launchLandingContent";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    titleKey: "launch_town.metadata.title",
    descriptionKey: "launch_town.metadata.description",
    path: "/barnegat-nj",
    values: {
      area: launchAreaLabel
    }
  });
}

const trustPointKeys = [
  "launch_town.trust.point.recommendation",
  "launch_town.trust.point.backups",
  "launch_town.trust.point.support"
] satisfies TranslationKey[];

const localFaqs = [
  {
    questionKey: "launch_town.faq.services.question",
    answerKey: "launch_town.faq.services.answer"
  },
  {
    questionKey: "launch_town.faq.unavailable.question",
    answerKey: "launch_town.faq.unavailable.answer"
  },
  {
    questionKey: "launch_town.faq.why_local.question",
    answerKey: "launch_town.faq.why_local.answer"
  }
] satisfies Array<{ questionKey: TranslationKey; answerKey: TranslationKey }>;

const launchTownPageLinks = [
  {
    href: launchServiceContent["lawn-mowing"].townPath,
    titleKey: "launch_town.service.lawn_mowing.title",
    bodyKey: "launch_town.service.lawn_mowing.body"
  },
  {
    href: launchServiceContent["yard-cleanup"].townPath,
    titleKey: "launch_town.service.yard_cleanup.title",
    bodyKey: "launch_town.service.yard_cleanup.body"
  },
  {
    href: launchServiceContent["lawn-mowing"].path,
    titleKey: "launch_town.service.general_lawn.title",
    bodyKey: "launch_town.service.general_lawn.body"
  },
  {
    href: launchServiceContent["yard-cleanup"].path,
    titleKey: "launch_town.service.general_cleanup.title",
    bodyKey: "launch_town.service.general_cleanup.body"
  }
] satisfies Array<{ href: string; titleKey: TranslationKey; bodyKey: TranslationKey }>;

export default async function BarnegatTownPage() {
  const i18n = await getRequestI18n();
  const values = {
    area: launchAreaLabel,
    shortArea: launchAreaShortLabel
  };
  const href = (path: string) => addLocalePrefix(path, i18n.locale);

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">{i18n.t("launch_town.hero.eyebrow")}</span>
        <h1>{i18n.t("launch_town.hero.title", values)}</h1>
        <p>{i18n.t("launch_town.hero.body")}</p>
        <div className="cta-row">
          <Link className="button" href={href(`/customer?area=${encodeURIComponent(launchAreaLabel)}`)}>
            {i18n.t("launch_town.hero.primary_cta")}
          </Link>
          <Link className="button-secondary" href={href("/about")}>
            {i18n.t("launch_town.hero.secondary_cta")}
          </Link>
        </div>
      </section>

      <section className="grid-two">
        <article className="card">
          <h2>{i18n.t("launch_town.trust.title")}</h2>
          <ul className="timeline">
            {trustPointKeys.map((key) => (
              <li key={key}>
                <strong>•</strong>
                <span>{i18n.t(key)}</span>
              </li>
            ))}
          </ul>
        </article>
        <article className="card">
          <h2>{i18n.t("launch_town.optimizing.title")}</h2>
          <p>{i18n.t("launch_town.optimizing.body", values)}</p>
        </article>
      </section>

      <section className="stack-lg">
        <div className="section-header">
          <h2>{i18n.t("launch_town.services.title", values)}</h2>
          <p>{i18n.t("launch_town.services.body")}</p>
        </div>
        <div className="grid-two">
          {launchTownPageLinks.map((item) => (
            <article className="card" key={item.href}>
              <h3>{i18n.t(item.titleKey, values)}</h3>
              <p>{i18n.t(item.bodyKey)}</p>
              <Link className="button-secondary" href={href(item.href)}>
                {i18n.t("launch_town.services.view_page")}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <LaunchMarketplaceProofSection
        description={i18n.t("launch_town.proof.body", values)}
        preferredAreaLabel={launchAreaLabel}
        title={i18n.t("launch_town.proof.title", values)}
      />

      <section>
        <LaunchLeadCaptureCard
          defaultAreaLabel={launchAreaLabel}
          description={i18n.t("launch_town.lead.body")}
          requestSource="launch-town-page-lead-form"
          title={i18n.t("launch_town.lead.title", values)}
        />
      </section>

      <section className="grid-two">
        <article className="card">
          <h2>{i18n.t("launch_town.local_trust.title")}</h2>
          <p>{i18n.t("launch_town.local_trust.body")}</p>
          <div className="cta-row" style={{ marginTop: "1rem" }}>
            <Link className="button-secondary" href={href("/provider-verification")}>
              {i18n.t("launch_town.local_trust.cta")}
            </Link>
          </div>
        </article>
        <article className="card">
          <h2>{i18n.t("launch_town.support.title")}</h2>
          <p>{i18n.t("launch_town.support.body")}</p>
          <div className="cta-row" style={{ marginTop: "1rem" }}>
            <Link className="button-secondary" href={href("/help")}>
              {i18n.t("launch_town.support.cta")}
            </Link>
          </div>
        </article>
      </section>

      <section className="stack-lg">
        <div className="section-header">
          <h2>{i18n.t("launch_town.faq.title")}</h2>
          <p>{i18n.t("launch_town.faq.body")}</p>
        </div>
        <div className="grid-two">
          {localFaqs.map((item) => (
            <article className="card" key={item.questionKey}>
              <h3>{i18n.t(item.questionKey, values)}</h3>
              <p>{i18n.t(item.answerKey)}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
