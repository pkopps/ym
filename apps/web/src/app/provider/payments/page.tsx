import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProviderPaymentsBoard } from "../../../components/ProviderPaymentsBoard";
import { getLaunchFeatureFlags } from "../../../lib/feature-flags-server";
import { getLocalizedPageMetadata, getRequestI18n } from "../../../lib/i18n-server";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/provider/payments",
    titleKey: "provider_payments.metadata.title",
    descriptionKey: "provider_payments.metadata.description"
  });
}

export default async function ProviderPaymentsPage() {
  if (!getLaunchFeatureFlags().payments) {
    notFound();
  }

  const i18n = await getRequestI18n();

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <div className="search-result-title">
          <div>
            <h1>{i18n.t("provider_payments.hero.title")}</h1>
          </div>

        </div>
      </section>

      <ProviderPaymentsBoard />
    </main>
  );
}
