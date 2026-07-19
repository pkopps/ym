import type { Metadata } from "next";
import { PublicCustomerListingsExperience } from "../../../components/PublicCustomerListingsExperience";
import { serviceCategoryLabels } from "@yardmatch/ui";
import { ServiceCategory } from "@yardmatch/contracts";
import { addLocalePrefix } from "@yardmatch/i18n";
import {
  CustomerCustomTimingWindow,
  CustomerTimingPreference
} from "../../../components/PublicMarketplaceSearchShell";
import { getRequestI18n } from "../../../lib/i18n-server";
import { launchAreaLabel, noIndexRobots } from "../../../lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getRequestI18n();
  return {
    title: i18n.t("metadata.listings.title", { area: launchAreaLabel }),
    description: i18n.t("metadata.listings.description"),
    alternates: {
      languages: {
        en: "/customer/listings",
        es: addLocalePrefix("/customer/listings", "es")
      }
    },
    robots: noIndexRobots
  };
}

export default async function CustomerListingsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const serviceValue =
    typeof resolvedSearchParams.service === "string" ? resolvedSearchParams.service : undefined;
  const areaLabel =
    typeof resolvedSearchParams.area === "string" ? resolvedSearchParams.area : undefined;
  const city = typeof resolvedSearchParams.city === "string" ? resolvedSearchParams.city : undefined;
  const state =
    typeof resolvedSearchParams.state === "string" ? resolvedSearchParams.state : undefined;
  const postalCode =
    typeof resolvedSearchParams.postalCode === "string"
      ? resolvedSearchParams.postalCode
      : undefined;
  const initialService =
    serviceValue && serviceValue in serviceCategoryLabels ? (serviceValue as ServiceCategory) : undefined;
  const initialTiming =
    typeof resolvedSearchParams.when === "string"
      ? (resolvedSearchParams.when as CustomerTimingPreference)
      : undefined;
  const initialCustomDate =
    typeof resolvedSearchParams.start === "string"
      ? resolvedSearchParams.start
      : typeof resolvedSearchParams.date === "string"
        ? resolvedSearchParams.date
        : undefined;
  const initialCustomEndDate =
    typeof resolvedSearchParams.end === "string" ? resolvedSearchParams.end : undefined;
  const initialCustomWindow =
    typeof resolvedSearchParams.window === "string"
      ? (resolvedSearchParams.window as CustomerCustomTimingWindow)
      : undefined;
  const initialCustomWindows =
    typeof resolvedSearchParams.windows === "string"
      ? (resolvedSearchParams.windows.split(",").filter(Boolean) as CustomerCustomTimingWindow[])
      : undefined;
  const initialAdditionalTimings =
    typeof resolvedSearchParams.also === "string"
      ? (resolvedSearchParams.also.split(",").filter(Boolean) as CustomerTimingPreference[])
      : undefined;
  const lat =
    typeof resolvedSearchParams.lat === "string" ? Number.parseFloat(resolvedSearchParams.lat) : undefined;
  const lng =
    typeof resolvedSearchParams.lng === "string" ? Number.parseFloat(resolvedSearchParams.lng) : undefined;

  return (
    <main className="container container--wide stack-lg">
      <PublicCustomerListingsExperience
        initialAreaLabel={areaLabel}
        initialCity={city}
        initialLat={Number.isFinite(lat) ? lat : undefined}
        initialLng={Number.isFinite(lng) ? lng : undefined}
        initialPostalCode={postalCode}
        initialAdditionalTimings={initialAdditionalTimings}
        initialCustomDate={initialCustomDate}
        initialCustomEndDate={initialCustomEndDate}
        initialCustomWindow={initialCustomWindow}
        initialCustomWindows={initialCustomWindows}
        initialService={initialService}
        initialState={state}
        initialTiming={initialTiming}
      />
    </main>
  );
}
