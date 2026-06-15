"use client";

import { PlaceSuggestion, ServiceCategory } from "@yardmatch/contracts";
import { bookedBusinessShowcase, faqItems } from "@yardmatch/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HomeServiceScroller } from "./HomeServiceScroller";
import {
  buildCustomerListingsSearchParams,
  PublicMarketplaceSearchShell
} from "./PublicMarketplaceSearchShell";
import { StructuredData } from "./StructuredData";

const rotatingServices = ["lawn mowing", "cleanup", "hedge trimming", "mulch refresh"] as const;

function formatAverageRating() {
  const average =
    bookedBusinessShowcase.reduce((sum, business) => sum + Number(business.rating), 0) /
    bookedBusinessShowcase.length;
  return average.toFixed(1);
}

function formatAverageDistance() {
  const average =
    bookedBusinessShowcase.reduce((sum, business) => sum + business.distanceMiles, 0) /
    bookedBusinessShowcase.length;
  return average.toFixed(1);
}

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
    <main className="market-home">
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
          <span className="eyebrow">GreenRain by YardMatch</span>
          <h1 className="home-hero__headline">
            <span>Tell us what needs care.</span>
            <span className="home-hero__headline-accent">
              We’ll match the best local fit for <HomeServiceScroller services={rotatingServices} />.
            </span>
          </h1>
          <p className="home-hero__lede">
            Start with one recommended provider, a real route opening, and short backup options only if you want them.
          </p>
          <div className="home-hero__trust-strip" aria-label="Why customers book with GreenRain">
            <span>One best match first</span>
            <span>Real route openings</span>
            <span>Support if plans change</span>
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
            <a className="button" href="/customer/listings">
              See my match
            </a>
            <a className="button-secondary" href="/auth/provider">
              I run a landscaping business
            </a>
            <a className="button-secondary" href="/auth/crew">
              I want crew work
            </a>
          </div>
          <div className="market-home__proof">
            <div className="market-home__proof-card">
              <strong>{bookedBusinessShowcase.length}</strong>
              <span>busy sample providers</span>
            </div>
            <div className="market-home__proof-card">
              <strong>{formatAverageRating()}</strong>
              <span>average rating shown</span>
            </div>
            <div className="market-home__proof-card">
              <strong>{formatAverageDistance()} mi</strong>
              <span>average route distance</span>
            </div>
          </div>
        </div>
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>How GreenRain works</h2>
          <p>Three quick steps. No directory rabbit hole.</p>
        </div>
        <div className="grid-three market-home__steps">
          <article className="card market-home__step">
            <strong>1. Tell us the job</strong>
            <p>Pick the service and the property. We clean up the address before matching.</p>
          </article>
          <article className="card market-home__step">
            <strong>2. Review the best fit</strong>
            <p>See one recommended provider first, plus why they were picked.</p>
          </article>
          <article className="card market-home__step">
            <strong>3. Book and track</strong>
            <p>Hold the route window, pay in one flow, and track arrival without chasing texts.</p>
          </article>
        </div>
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>Built for every side of the work</h2>
          <p>One system for homeowners, businesses, and crews.</p>
        </div>
        <div className="grid-three">
          <article className="card">
            <span className="eyebrow">Customers</span>
            <p>Get matched fast, keep recurring care simple, and track the route when someone is on the way.</p>
          </article>
          <article className="card">
            <span className="eyebrow">Business owners</span>
            <p>Run bookings, crews, payouts, and dispatch decisions in one management flow.</p>
          </article>
          <article className="card">
            <span className="eyebrow">Crew members</span>
            <p>See assignments, directions, availability, and payout status in one place.</p>
          </article>
        </div>
      </section>

      <section className="container stack-lg market-home__market-proof">
        <div className="section-header">
          <h2>What a busy marketplace looks like</h2>
          <p>Established providers can fill up quickly when route density gets healthy.</p>
        </div>
        <div className="grid-three market-home__market-grid">
          {bookedBusinessShowcase.slice(0, 6).map((business) => (
            <article className="card market-home__business-card" key={business.name}>
              <strong>{business.name}</strong>
              <p>{business.city}</p>
              <p>
                {business.rating} stars • {business.distanceMiles} mi away
              </p>
              <p>{business.specialties[0]}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container stack-lg">
        <div className="section-header">
          <h2>Frequently asked questions</h2>
          <p>Short answers before you book.</p>
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
