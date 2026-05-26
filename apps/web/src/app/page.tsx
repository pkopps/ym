import {
  bookedBusinessShowcase,
  faqItems,
  serviceCategoryLabels
} from "@yardmatch/ui";
import { BookedBusinessResults } from "../components/BookedBusinessResults";
import { StructuredData } from "../components/StructuredData";

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

export default function HomePage() {
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
      <section className="container hero">
        <div>
          <span className="eyebrow">YardMatch</span>
          <h1>Book local lawn care. Grow your landscaping business. Join a crew.</h1>
          <p>One platform for customers, business owners, and crew members.</p>
          <div className="cta-row">
            <a className="button" href="/customer">
              Book lawn care
            </a>
            <a className="button-secondary" href="/provider">
              Run my business
            </a>
            <a className="button-secondary" href="/crew">
              Join a crew
            </a>
          </div>
          <div className="chip-row" style={{ marginTop: "1.5rem" }}>
            {Object.values(serviceCategoryLabels).map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
        <aside className="hero-rail">
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
        </aside>
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
                <p>9:00 AM mow and edge</p>
                <div className="app-banner__slots">
                  <span>9:00</span>
                  <span>11:00</span>
                  <span>1:00</span>
                </div>
              </div>
              <div className="app-banner__screen-card">
                <strong>Blue Harbor Outdoor</strong>
                <p>2:30 PM hedge trim</p>
                <div className="app-banner__slots">
                  <span>2:30</span>
                  <span>4:00</span>
                  <span>5:30</span>
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
