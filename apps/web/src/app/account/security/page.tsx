import { PrivacyRequestPanel } from "../../../components/PrivacyRequestPanel";
import type { Metadata } from "next";
import { SecuritySettingsPanel } from "../../../components/SecuritySettingsPanel";
import { getLocalizedPageMetadata, getRequestI18n } from "../../../lib/i18n-server";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/account/security",
    titleKey: "security.title",
    descriptionKey: "security.description"
  });
}

export default async function AccountSecurityPage() {
  const i18n = await getRequestI18n();
  return (
    <main className="container stack-lg">
      <section className="section-header">
        <span className="eyebrow">{i18n.t("security.eyebrow")}</span>
        <h1>{i18n.t("security.title")}</h1>
        <p>{i18n.t("security.description")}</p>
      </section>
      <SecuritySettingsPanel />
      <PrivacyRequestPanel />
    </main>
  );
}
