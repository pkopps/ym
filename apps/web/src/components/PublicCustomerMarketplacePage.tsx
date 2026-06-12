"use client";

import {
  bookedBusinessShowcase,
  faqItems,
  serviceCategoryLabels
} from "@yardmatch/ui";
import { PlaceSuggestion, ServiceCategory } from "@yardmatch/contracts";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookedBusinessResults } from "./BookedBusinessResults";
import { HomeServiceScroller } from "./HomeServiceScroller";
import { landscapingToolIllustrations } from "../lib/landscapingToolIllustrations";
import {
  buildCustomerListingsSearchParams,
  PublicMarketplaceSearchShell
} from "./PublicMarketplaceSearchShell";
import { StructuredData } from "./StructuredData";

const topRatedLandscapers = bookedBusinessShowcase
  .slice()
  .sort((left, right) => Number(right.rating) - Number(left.rating))
  .slice(0, 5);

const topPunctualLandscapers = [
  { ...bookedBusinessShowcase[0], punctuality: "4.9" },
  { ...bookedBusinessShowcase[3], punctuality: "4.9" },
  { ...bookedBusinessShowcase[4], punctuality: "4.8" },
  { ...bookedBusinessShowcase[1], punctuality: "4.8" },
  { ...bookedBusinessShowcase[2], punctuality: "4.7" }
];

const rotatingServices = [
  "lawn mowing",
  "weed whacking",
  "hedge trimming",
  "mulch installs",
  "leaf blowing",
  "snow shoveling"
] as const;

export function PublicCustomerMarketplacePage() {
  const router = useRouter();
  const [selectedService, setSelectedService] = useState<ServiceCategory>("lawn-mowing");
  const [areaQuery, setAreaQuery] = useState("Brooklyn, NY");
  const [selectedSuggestion, setSelectedSuggestion] = useState<PlaceSuggestion | undefined>();

  function handleSearch(service: ServiceCategory, suggestion?: PlaceSuggestion) {
    const params = buildCustomerListingsSearchParams({
      areaQuery,
      selectedService: service,
      selectedSuggestion: suggestion
    });

    router.push(`/customer/listings?${params.toString()}`);
  }

  return (
    <main>
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "YardMatch",
          description:
            "Marketplace for lawn care bookings, landscaping business operations, and crew-member staffing.",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://yardmatch.example/customer?query={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        }}
      />
      <section className="container hero home-hero customer-public-hero">
        <div className="home-hero__content">
          <h1 className="home-hero__headline">
            <span>Book local</span>
            <HomeServiceScroller services={rotatingServices} />
          </h1>
          <p className="home-hero__lede">
            Search nearby landscaping businesses, compare live availability, and book a clear
            service window without getting stuck in lead forms.
          </p>
          <div className="home-hero__trust-strip" aria-label="Why customers book with GreenRain">
            <span>Tracked arrivals</span>
            <span>Provider reviews</span>
            <span>Support-backed refunds</span>
          </div>
          <PublicMarketplaceSearchShell
            areaQuery={areaQuery}
            onAreaQueryChange={setAreaQuery}
            onSearch={handleSearch}
            onSelectedServiceChange={setSelectedService}
            onSelectedSuggestionChange={setSelectedSuggestion}
            selectedService={selectedService}
            selectedSuggestion={selectedSuggestion}
          />
          <div className="cta-row">
            <a className="button-secondary" href="/customer/listings">
              Browse local pros
            </a>
            <a className="button-secondary" href="/auth/provider">
              Grow my business
            </a>
            <a className="button-secondary" href="/crew">
              Join a crew
            </a>
          </div>
          <div className="chip-row" style={{ marginTop: "1.5rem" }}>
            {Object.entries(serviceCategoryLabels).map(([value, label]) => (
              <button
                className={`chip-row__button${label === "Snow shoveling" ? " chip-row__button--winter" : ""}`}
                key={value}
                onClick={() => {
                  const nextService = value as ServiceCategory;
                  setSelectedService(nextService);
                  handleSearch(nextService, selectedSuggestion);
                }}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="hero-rail home-hero__carousels">
            <section className="hero-carousel">
              <div className="hero-carousel__header">
                <h2>Highest rated landscapers</h2>
                <span>Top overall</span>
              </div>
              <div className="hero-carousel__track">
                {topRatedLandscapers.map((business) => (
                  <article className="hero-carousel-card" key={`${business.name}-overall`}>
                    <img
                      alt={`${business.ownerName} from ${business.name}`}
                      className="hero-carousel-card__avatar"
                      src={business.avatarUrl}
                    />
                    <div>
                      <strong>{business.name}</strong>
                      <p>{business.ownerName}</p>
                      <p>{business.rating} overall • {business.distanceMiles} mi away</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="hero-carousel">
              <div className="hero-carousel__header">
                <h2>High punctuality</h2>
                <span>Shows up on time</span>
              </div>
              <div className="hero-carousel__track">
                {topPunctualLandscapers.map((business) => (
                  <article className="hero-carousel-card" key={`${business.name}-punctuality`}>
                    <img
                      alt={`${business.ownerName} from ${business.name}`}
                      className="hero-carousel-card__avatar"
                      src={business.avatarUrl}
                    />
                    <div>
                      <strong>{business.name}</strong>
                      <p>{business.ownerName}</p>
                      <p>{business.punctuality} punctuality • {business.city}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>

      <section className="container stack-lg">
        <div className="tool-illustration-row">
          {landscapingToolIllustrations.map((illustration) => (
            <article className="tool-illustration-card" key={illustration.id}>
              <div className="tool-illustration-card__image-wrap">
                <img
                  alt={illustration.alt}
                  className="tool-illustration-card__image"
                  height={240}
                  src={illustration.src}
                  width={240}
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="container app-banner">
        <div className="app-banner__content">
          <span className="eyebrow">Mobile apps</span>
          <h2>YardMatch on the go.</h2>
          <p>Book services, run routes, or manage crew work from your phone.</p>
          <p className="app-banner__subcopy">Scan to get the app.</p>
          <div className="app-banner__qr" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="app-banner__badges">
            <a className="store-badge" href="/customer">
              <span className="store-badge__icon store-badge__icon--apple" aria-hidden="true">
                &#63743;
              </span>
              <small>Download on the</small>
              <strong>App Store</strong>
            </a>
            <a className="store-badge" href="/customer">
              <span className="store-badge__icon store-badge__icon--play" aria-hidden="true">
                &#9654;
              </span>
              <small>Get it on</small>
              <strong>Google Play</strong>
            </a>
          </div>
        </div>

        <div className="app-banner__visual" aria-hidden="true">
          <div className="app-banner__halo" />
          <div className="app-banner__phone">
            <div className="app-banner__phone-top" />
            <div className="app-banner__screen">
              <div className="app-banner__screen-header">
                <strong>YardMatch</strong>
                <span>Today</span>
              </div>
              <div className="app-banner__screen-card">
                <strong>GreenStride Lawn Co.</strong>
                <p>Morning mow and edge</p>
                <div className="app-banner__slots">
                  <span>Morning</span>
                  <span>Afternoon</span>
                  <span>Late afternoon / evening</span>
                </div>
              </div>
              <div className="app-banner__screen-card">
                <strong>Blue Harbor Outdoor</strong>
                <p>Late afternoon hedge trim</p>
                <div className="app-banner__slots">
                  <span>Morning</span>
                  <span>Afternoon</span>
                  <span>Late afternoon / evening</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container container--wide stack-lg">
        <div className="section-header">
          <h2>Booked-up businesses on the platform</h2>
          <p>See how busy calendars can look on YardMatch.</p>
        </div>
        <BookedBusinessResults showOpenListingsLink />
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>Built for every side of the job</h2>
        </div>
        <div className="grid-three">
          <article className="card">
            <span className="eyebrow">Customers</span>
            <p>Search by address, compare pros, and book in minutes.</p>
          </article>
          <article className="card">
            <span className="eyebrow">Business owners</span>
            <p>Fill schedules, tighten routes, and grow local demand.</p>
          </article>
          <article className="card">
            <span className="eyebrow">Crew members</span>
            <p>Find assignments, set availability, and stay job-ready.</p>
          </article>
        </div>
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>Frequently asked questions</h2>
          <p>Quick answers.</p>
        </div>
        <div className="grid-three">
          {faqItems.map((item) => (
            <article className="faq-item" key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
