import type { Metadata } from "next";
import { ProviderClientsBoard } from "../../../components/ProviderClientsBoard";
import { getRequestI18n } from "../../../lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getRequestI18n();
  return { title: `${i18n.t("provider_clients.nav")} | YardMatch`, robots: { index: false, follow: false } };
}

export default function ProviderClientsPage() {
  return <main className="container provider-clients-page"><ProviderClientsBoard /></main>;
}
