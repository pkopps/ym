import type { Metadata } from "next";
import { PublicCustomerMarketplacePage } from "../components/PublicCustomerMarketplacePage";
import { addLocalePrefix } from "@yardmatch/i18n";
import { getRequestI18n } from "../lib/i18n-server";
import { buildSiteUrl, launchAreaLabel } from "../lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getRequestI18n();
  const localizedPath = addLocalePrefix("/", i18n.locale);
  const title = i18n.t("metadata.home.title", { area: launchAreaLabel });
  const description = i18n.t("metadata.home.description", { area: launchAreaLabel });

  return {
    title,
    description,
    alternates: {
      canonical: buildSiteUrl(localizedPath),
      languages: {
        en: buildSiteUrl("/"),
        es: buildSiteUrl("/es"),
        "x-default": buildSiteUrl("/")
      }
    },
    openGraph: {
      title: `${title} | YardMatch`,
      description: i18n.t("metadata.home.og_description", { area: launchAreaLabel }),
      url: buildSiteUrl(localizedPath)
    }
  };
}

export default function HomePage() {
  return <PublicCustomerMarketplacePage />;
}
