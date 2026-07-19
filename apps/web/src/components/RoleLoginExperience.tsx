"use client";

import { MarketplaceRole } from "@yardmatch/contracts";
import { addLocalePrefix, type TranslationKey } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { Suspense } from "react";
import { landscapingToolIllustrations } from "../lib/landscapingToolIllustrations";
import { LoadingScreen } from "./LoadingScreen";
import { RoleLoginCard } from "./RoleLoginCard";

const roleExperienceCopy: Record<
  MarketplaceRole,
  {
    eyebrowKey: TranslationKey;
    titleKey: TranslationKey;
    descriptionKey: TranslationKey;
    illustrationId: (typeof landscapingToolIllustrations)[number]["id"];
    metrics: Array<{ valueKey: TranslationKey; labelKey: TranslationKey }>;
    highlightKeys: TranslationKey[];
    primaryHref: string;
    primaryLabelKey: TranslationKey;
    secondaryHref: string;
    secondaryLabelKey: TranslationKey;
    formEyebrowKey: TranslationKey;
    formTitleKey: TranslationKey;
    formCopyKey: TranslationKey;
  }
> = {
  customer: {
    eyebrowKey: "login_experience.customer.eyebrow",
    titleKey: "login_experience.customer.title",
    descriptionKey: "login_experience.customer.description",
    illustrationId: "lawn-mower",
    metrics: [
      { valueKey: "login_experience.customer.metric.tracking.value", labelKey: "login_experience.customer.metric.tracking.label" },
      { valueKey: "login_experience.customer.metric.weekly.value", labelKey: "login_experience.customer.metric.weekly.label" },
      { valueKey: "login_experience.customer.metric.support.value", labelKey: "login_experience.customer.metric.support.label" }
    ],
    highlightKeys: [
      "login_experience.customer.highlight.tracking",
      "login_experience.customer.highlight.recurring",
      "login_experience.customer.highlight.timeline"
    ],
    primaryHref: "/auth",
    primaryLabelKey: "login_experience.customer.primary_cta",
    secondaryHref: "/customer/listings",
    secondaryLabelKey: "login_experience.customer.secondary_cta",
    formEyebrowKey: "login_experience.customer.form_eyebrow",
    formTitleKey: "login_experience.customer.form_title",
    formCopyKey: "login_experience.customer.form_copy"
  },
  provider: {
    eyebrowKey: "login_experience.provider.eyebrow",
    titleKey: "login_experience.provider.title",
    descriptionKey: "login_experience.provider.description",
    illustrationId: "leaf-blower",
    metrics: [
      { valueKey: "login_experience.provider.metric.route.value", labelKey: "login_experience.provider.metric.route.label" },
      { valueKey: "login_experience.provider.metric.crew.value", labelKey: "login_experience.provider.metric.crew.label" },
      { valueKey: "login_experience.provider.metric.ops.value", labelKey: "login_experience.provider.metric.ops.label" }
    ],
    highlightKeys: [
      "login_experience.provider.highlight.windows",
      "login_experience.provider.highlight.gaps",
      "login_experience.provider.highlight.assistant"
    ],
    primaryHref: "/auth/provider/create",
    primaryLabelKey: "login_experience.provider.primary_cta",
    secondaryHref: "/help",
    secondaryLabelKey: "login_experience.provider.secondary_cta",
    formEyebrowKey: "login_experience.provider.form_eyebrow",
    formTitleKey: "login_experience.provider.form_title",
    formCopyKey: "login_experience.provider.form_copy"
  },
  ops: {
    eyebrowKey: "login_experience.ops.eyebrow",
    titleKey: "login_experience.ops.title",
    descriptionKey: "login_experience.ops.description",
    illustrationId: "hedge-trimmer",
    metrics: [
      { valueKey: "login_experience.ops.metric.ops.value", labelKey: "login_experience.ops.metric.ops.label" },
      { valueKey: "login_experience.ops.metric.support.value", labelKey: "login_experience.ops.metric.support.label" },
      { valueKey: "login_experience.ops.metric.launch.value", labelKey: "login_experience.ops.metric.launch.label" }
    ],
    highlightKeys: [
      "login_experience.ops.highlight.support",
      "login_experience.ops.highlight.health",
      "login_experience.ops.highlight.login"
    ],
    primaryHref: "/help",
    primaryLabelKey: "login_experience.ops.primary_cta",
    secondaryHref: "/login",
    secondaryLabelKey: "login_experience.ops.secondary_cta",
    formEyebrowKey: "login_experience.ops.form_eyebrow",
    formTitleKey: "login_experience.ops.form_title",
    formCopyKey: "login_experience.ops.form_copy"
  },
  "crew-member": {
    eyebrowKey: "login_experience.crew.eyebrow",
    titleKey: "login_experience.crew.title",
    descriptionKey: "login_experience.crew.description",
    illustrationId: "string-trimmer",
    metrics: [
      { valueKey: "login_experience.crew.metric.live.value", labelKey: "login_experience.crew.metric.live.label" },
      { valueKey: "login_experience.crew.metric.directions.value", labelKey: "login_experience.crew.metric.directions.label" },
      { valueKey: "login_experience.crew.metric.clear.value", labelKey: "login_experience.crew.metric.clear.label" }
    ],
    highlightKeys: [
      "login_experience.crew.highlight.work",
      "login_experience.crew.highlight.cancellation",
      "login_experience.crew.highlight.history"
    ],
    primaryHref: "/auth/crew",
    primaryLabelKey: "login_experience.crew.primary_cta",
    secondaryHref: "/crew",
    secondaryLabelKey: "login_experience.crew.secondary_cta",
    formEyebrowKey: "login_experience.crew.form_eyebrow",
    formTitleKey: "login_experience.crew.form_title",
    formCopyKey: "login_experience.crew.form_copy"
  }
};

export function RoleLoginExperience({ role }: { role: MarketplaceRole }) {
  const i18n = useI18n();
  const content = roleExperienceCopy[role];
  const illustration = landscapingToolIllustrations.find((item) => item.id === content.illustrationId);

  return (
    <main className="container stack-lg">
      <section className="role-login-shell">
        <div className="role-login-shell__story">
          <span className="eyebrow">{i18n.t(content.eyebrowKey)}</span>
          <h1>{i18n.t(content.titleKey)}</h1>
          <p>{i18n.t(content.descriptionKey)}</p>

          <div className="role-login-shell__metrics">
            {content.metrics.map((metric) => (
              <div className="role-login-shell__metric" key={metric.labelKey}>
                <strong>{i18n.t(metric.valueKey)}</strong>
                <span>{i18n.t(metric.labelKey)}</span>
              </div>
            ))}
          </div>

          <div className="role-login-shell__feature-panel">
            {illustration ? (
              <div className="role-login-shell__art">
                <img alt={i18n.t(illustration.altKey)} src={illustration.src} />
              </div>
            ) : null}
            <ul className="role-login-shell__highlights">
              {content.highlightKeys.map((key) => (
                <li key={key}>{i18n.t(key)}</li>
              ))}
            </ul>
          </div>

          <div className="cta-row">
            <a className="button" href={addLocalePrefix(content.primaryHref, i18n.locale)}>
              {i18n.t(content.primaryLabelKey)}
            </a>
            <a className="button-secondary" href={addLocalePrefix(content.secondaryHref, i18n.locale)}>
              {i18n.t(content.secondaryLabelKey)}
            </a>
          </div>
        </div>

        <div className="role-login-shell__form-column">
          <div className="role-login-shell__form-intro">
            <span className="eyebrow">{i18n.t(content.formEyebrowKey)}</span>
            <h2>{i18n.t(content.formTitleKey)}</h2>
            <p>{i18n.t(content.formCopyKey)}</p>
          </div>
          <Suspense fallback={<LoadingScreen label={i18n.t("login_experience.loading")} />}>
            <RoleLoginCard role={role} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
