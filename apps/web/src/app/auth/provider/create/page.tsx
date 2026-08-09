import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountSignupForm } from "../../../../components/AccountSignupForm";
import { LoadingScreen } from "../../../../components/LoadingScreen";
import { getLocalizedPageMetadata, getRequestI18n } from "../../../../lib/i18n-server";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/auth/provider/create",
    titleKey: "auth_provider.metadata.title"
  });
}

export default async function ProviderSignupCreatePage() {
  const i18n = await getRequestI18n();

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">{i18n.t("auth_provider.eyebrow")}</span>
        <h1>{i18n.t("auth_provider.title")}</h1>
        <p>{i18n.t("auth_provider.body")}</p>
      </section>

      <section className="card provider-signup-economics" aria-label={i18n.t("auth_provider.economics.aria")}>
        <div>
          <span className="eyebrow">{i18n.t("auth_provider.economics.eyebrow")}</span>
          <h2>{i18n.t("auth_provider.economics.title")}</h2>
        </div>
        <p>{i18n.t("auth_provider.economics.body")}</p>
      </section>

      <Suspense fallback={<LoadingScreen label={i18n.t("auth_signup.loading")} />}>
        <AccountSignupForm role="provider" />
      </Suspense>
    </main>
  );
}
