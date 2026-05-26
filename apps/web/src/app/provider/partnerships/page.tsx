import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Business partnerships",
  description: "Illustrative YardMatch business partnership and affiliate deal concepts."
};

const partnerDeals = [
  {
    brand: "Ford",
    title: "Work truck pricing",
    body: "Preferred pricing ideas for new trucks, fleet upgrades, and service packages for growing landscaping teams."
  },
  {
    brand: "Home Depot",
    title: "Equipment and supply savings",
    body: "Illustrative discounts on mowers, trimmers, hand tools, seasonal supplies, and replacement parts."
  },
  {
    brand: "YardMatch financing partners",
    title: "Flexible purchase support",
    body: "Simple financing concepts for higher-ticket equipment so crews can expand without one large upfront hit."
  }
] as const;

export default function ProviderPartnershipsPage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">Business partnerships</span>
        <h1>Equipment and truck deals for YardMatch businesses.</h1>
        <p>Short, simple, and theoretical for now. Think preferred partner savings that help your crew stay equipped as demand grows.</p>
      </section>

      <section className="grid-three">
        {partnerDeals.map((deal) => (
          <article className="card" key={deal.title}>
            <span className="eyebrow">{deal.brand}</span>
            <h2>{deal.title}</h2>
            <p>{deal.body}</p>
          </article>
        ))}
      </section>

      <section className="provider-final-cta panel">
        <div>
          <span className="eyebrow">Illustrative only</span>
          <h2>These partnership examples show the kind of savings YardMatch could surface for business owners.</h2>
          <p>Exact terms, brands, and discounts would depend on real partner agreements.</p>
        </div>
        <div className="cta-row">
          <a className="button" href="/auth/provider/create">
            Get Started
          </a>
          <a className="button-secondary" href="/auth/provider">
            Back to business overview
          </a>
        </div>
      </section>
    </main>
  );
}
