import type { Metadata } from "next";
import { getLocalizedPageMetadata, getRequestI18n } from "../../../lib/i18n-server";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/provider/card-saved",
    titleKey: "provider_card_saved.metadata.title",
    descriptionKey: "provider_card_saved.metadata.description"
  });
}

/** Where Stripe returns a provider who started card setup from the provider app. */
export default async function ProviderCardSavedPage({ searchParams }: { searchParams: Promise<{ billing?: string }> }) {
  const i18n = await getRequestI18n();
  const cancelled = (await searchParams).billing === "card-cancelled";
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <h1>{i18n.t(cancelled ? "provider_card_saved.cancelled_title" : "provider_card_saved.title")}</h1>
        <p>{i18n.t(cancelled ? "provider_card_saved.cancelled_body" : "provider_card_saved.body")}</p>
      </section>
    </main>
  );
}
