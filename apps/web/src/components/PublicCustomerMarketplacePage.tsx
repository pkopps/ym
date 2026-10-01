"use client";

import Link from "next/link";
import {
  PlaceSuggestion,
  ServiceCategory
} from "@yardmatch/contracts";
import { addLocalePrefix, TranslationKey } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CustomerQuickServiceChip,
  CustomerCustomTimingWindow,
  CustomerTimingPreference,
  buildCustomerListingsSearchParams,
  getDefaultCustomerCustomEndDateString,
  getDefaultCustomerCustomDateString,
  PublicMarketplaceSearchShell
} from "./PublicMarketplaceSearchShell";
import { buildSiteUrl, launchAreaLabel } from "../lib/site";
import { StructuredData } from "./StructuredData";

const quickServiceChips: CustomerQuickServiceChip[] = [
  {
    label: "market.home.quick.lawn_mowing.label",
    service: "lawn-mowing",
    imageSrc: "/media/landscaping-tools/lawn-mower.png",
    description: "market.home.quick.lawn_mowing.description"
  },
  {
    label: "market.home.quick.seasonal_cleanup.label",
    service: "seasonal-cleanup",
    imageSrc: "/media/landscaping-tools/leaf-blower.png",
    description: "market.home.quick.seasonal_cleanup.description"
  }
];

export function PublicCustomerMarketplacePage() {
  const i18n = useI18n();
  const router = useRouter();
  const [selectedService, setSelectedService] = useState<ServiceCategory>("lawn-mowing");
  const [locationPromptRequest, setLocationPromptRequest] = useState(0);
  const [areaQuery, setAreaQuery] = useState(launchAreaLabel);
  const [selectedSuggestion, setSelectedSuggestion] = useState<PlaceSuggestion | undefined>();
  const [selectedTiming, setSelectedTiming] = useState<CustomerTimingPreference>("tomorrow-morning");
  const [selectedAdditionalTimings, setSelectedAdditionalTimings] = useState<CustomerTimingPreference[]>([]);
  const [selectedCustomDate, setSelectedCustomDate] = useState(getDefaultCustomerCustomDateString());
  const [selectedCustomEndDate, setSelectedCustomEndDate] = useState(getDefaultCustomerCustomEndDateString());
  const [selectedCustomWindow, setSelectedCustomWindow] = useState<CustomerCustomTimingWindow>("morning");
  const [selectedCustomWindows, setSelectedCustomWindows] = useState<CustomerCustomTimingWindow[]>(["morning"]);

  function handleSearch(
    service: ServiceCategory,
    suggestion: PlaceSuggestion | undefined
  ) {
    const params = buildCustomerListingsSearchParams({
      areaQuery,
      selectedService: service,
      selectedSuggestion: suggestion
    });

    router.push(addLocalePrefix(`/customer/listings?${params.toString()}`, i18n.locale));
  }

  return (
    <main className="market-home">
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "YardMatch",
          description: i18n.t("structured.home.description"),
          potentialAction: {
            "@type": "SearchAction",
            target: buildSiteUrl(addLocalePrefix("/customer?query={search_term_string}", i18n.locale)),
            "query-input": i18n.t("structured.home.query_input")
          }
        }}
      />

      <section className="container hero home-hero customer-public-hero">
        <div className="home-hero__content">
          <div className="home-hero__header">
            <h1 className="home-hero__headline">{i18n.t("market.home.headline")}</h1>
          </div>
          <PublicMarketplaceSearchShell
            areaQuery={areaQuery}
            onAreaQueryChange={setAreaQuery}
            onSearch={handleSearch}
            onSelectedAdditionalTimingsChange={setSelectedAdditionalTimings}
            onSelectedCustomDateChange={setSelectedCustomDate}
            onSelectedCustomEndDateChange={setSelectedCustomEndDate}
            onSelectedCustomWindowChange={setSelectedCustomWindow}
            onSelectedCustomWindowsChange={setSelectedCustomWindows}
            onSelectedServiceChange={setSelectedService}
            onSelectedSuggestionChange={setSelectedSuggestion}
            onSelectedTimingChange={setSelectedTiming}
            selectedAdditionalTimings={selectedAdditionalTimings}
            selectedCustomDate={selectedCustomDate}
            selectedCustomEndDate={selectedCustomEndDate}
            selectedCustomWindow={selectedCustomWindow}
            selectedCustomWindows={selectedCustomWindows}
            selectedService={selectedService}
            selectedSuggestion={selectedSuggestion}
            selectedTiming={selectedTiming}
            showTimingSelection={false}
            promptForLocation
            locationPromptRequest={locationPromptRequest}
          />
        </div>
      </section>

      <section className="container stack-lg market-home__services">
        <div className="section-header">
          <h2>{i18n.t("market.home.popular.title")}</h2>
        </div>
        <div className="service-tile-grid">
          {quickServiceChips.map((item) => (
            <button
              className="service-tile-card"
              key={item.service}
              onClick={() => { setSelectedService(item.service); setLocationPromptRequest(value => value + 1); }}
              type="button"
            >
              <span className="service-tile-card__image-wrap" aria-hidden="true">
                <img
                  alt=""
                  className="service-tile-card__image"
                  height={128}
                  src={item.imageSrc}
                  width={128}
                />
              </span>
              <strong>{i18n.t(item.label as TranslationKey)}</strong>
              <span>{i18n.t(item.description as TranslationKey)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="container market-home__help">
        <div className="card market-home__help-card">
          <div>
            <h2>{i18n.t("market.home.lead.title")}</h2>
            <p>{i18n.t("market.home.lead.description")}</p>
          </div>
          <Link className="button-secondary" href={addLocalePrefix("/help#contact-us", i18n.locale)}>
            {i18n.t("market.home.proof.opening.cta")}
          </Link>
        </div>
      </section>
    </main>
  );
}
