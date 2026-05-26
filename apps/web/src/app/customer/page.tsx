import type { Metadata } from "next";
import { propertyMaintenanceChecklist } from "@yardmatch/ui";

export const metadata: Metadata = {
  title: "Book lawn and landscaping services",
  description: "Search nearby landscapers, compare availability, book services, and manage refunds."
};

const nearbyProviders = [
  {
    name: "GreenStride Lawn Co.",
    sponsored: true,
    eta: "2.4 miles away",
    rating: "4.9",
    nextSlot: "Tomorrow at 9:00 AM"
  },
  {
    name: "TerraCut Studio",
    sponsored: false,
    eta: "5.1 miles away",
    rating: "4.8",
    nextSlot: "Tomorrow at 1:30 PM"
  },
  {
    name: "Cedarstone Landscaping",
    sponsored: true,
    eta: "6.3 miles away",
    rating: "4.7",
    nextSlot: "Tomorrow at 3:00 PM"
  }
];

const reviewOpportunities = [
  {
    bookingId: "YM-BOOKING-2048",
    providerName: "GreenStride Lawn Co.",
    completedAt: "Completed Apr 28 at 2:40 PM",
    statusLabel: "Review email scheduled",
    detail: "Review invite goes out 48 hours after completion.",
    cta: "Email pending"
  },
  {
    bookingId: "YM-BOOKING-1982",
    providerName: "TerraCut Studio",
    completedAt: "Completed Apr 25 at 11:15 AM",
    statusLabel: "Ready for review",
    detail: "Review is ready in app or by email.",
    cta: "Review this booking"
  },
  {
    bookingId: "YM-BOOKING-1904",
    providerName: "Cedarstone Landscaping",
    completedAt: "Completed Apr 18 at 4:05 PM",
    statusLabel: "Review submitted",
    detail: "Review already submitted.",
    cta: "Reviewed"
  }
];

const completedMaintenanceCount = propertyMaintenanceChecklist.filter(
  (item) => item.status === "done"
).length;

export default function CustomerPage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">Dashboard</span>
        <h1>Your yard, on schedule.</h1>
        <p>Book, manage, and review service.</p>
      </section>

      <section className="property-guide">
        <div className="property-guide__header">
          <div>
            <span className="eyebrow">Property Maintenance Health Guide</span>
            <h2>Keep up with routine property work.</h2>
          </div>
          <div className="property-guide__progress">
            <strong>
              {completedMaintenanceCount} of {propertyMaintenanceChecklist.length} completed
            </strong>
          </div>
        </div>

        <div className="property-guide__grid">
          {propertyMaintenanceChecklist.map((item) => (
            <article className="maintenance-card" key={`${item.serviceTitle}-${item.taskTitle}`}>
              <div className="maintenance-card__meta">
                <span className="maintenance-card__service">{item.serviceTitle}</span>
                <strong
                  className={
                    item.status === "done"
                      ? "maintenance-card__status maintenance-card__status--done"
                      : "maintenance-card__status maintenance-card__status--due"
                  }
                >
                  {item.status === "done" ? "Done" : "Due"}
                </strong>
              </div>
              <h3>{item.taskTitle}</h3>
              <p>{item.guidance}</p>
              {item.completedLabel ? (
                <p className="maintenance-card__completed">{item.completedLabel}</p>
              ) : null}
              <div className="cta-row">
                <button className="button-secondary" type="button">
                  Book
                </button>
                <button className="button-secondary" type="button">
                  Mark as done
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid-two">
        <article className="card">
          <h2>Book a service</h2>
          <div className="form-grid">
            <label className="form-field">
              <span>Saved property</span>
              <select defaultValue="primary-home">
                <option value="primary-home">Primary home</option>
                <option value="rental-property">Rental property</option>
                <option value="parents-house">Parents' house</option>
              </select>
            </label>
            <label className="form-field form-field--full">
              <span>Service address</span>
              <input placeholder="220 Willow St, Nashville, TN 37206" />
            </label>
            <label className="form-field">
              <span>Instant quote</span>
              <input value="Runs automatically after address validation" readOnly />
            </label>
            <label className="form-field">
              <span>Requested service</span>
              <select defaultValue="lawn-mowing">
                <option value="lawn-mowing">Lawn mowing</option>
                <option value="hedge-trimming">Hedge trimming</option>
                <option value="mulch-installation">Mulch installation</option>
                <option value="leaf-blowing">Leaf blowing</option>
                <option value="aeration">Aeration</option>
                <option value="fertilization">Fertilization</option>
                <option value="gutter-cleaning">Gutter cleaning</option>
                <option value="snow-shoveling">Snow shoveling</option>
                <option value="ice-melt-salting">Ice melt and salting</option>
                <option value="snow-blowing">Snow blowing</option>
              </select>
            </label>
            <label className="form-field">
              <span>Preferred date</span>
              <input type="date" />
            </label>
            <label className="form-field form-field--full">
              <span>Property notes</span>
              <textarea rows={4} placeholder="Gate code, dog in yard, focus on front beds..." />
            </label>
          </div>
          <div className="cta-row" style={{ marginTop: "1rem" }}>
            <button className="button" type="button">
              Validate address and estimate quote
            </button>
          </div>
          <p>Start with the property and service you need.</p>
        </article>

        <article className="card">
          <h2>Quote preview</h2>
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            <article className="list-panel">
              <h3>Estimated total</h3>
              <p>$68 to mow • about 52 minutes • high confidence</p>
            </article>
            <article className="list-panel">
              <h3>Property details</h3>
              <p>3,900 sq ft turf • 420 sq ft shrub beds • medium lot complexity</p>
            </article>
            <article className="list-panel">
              <h3>Follow-up only when needed</h3>
              <p>We only ask follow-ups when needed.</p>
            </article>
          </div>
        </article>
      </section>

      <section className="grid-two">
        <article className="card">
          <h2>Top matches</h2>
          <div className="cta-row" style={{ marginBottom: "1rem" }}>
            <a className="button-secondary" href="/customer/listings">
              Open dedicated listing view
            </a>
          </div>
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            {nearbyProviders.map((provider) => (
              <article className="list-panel" key={provider.name}>
                <div className="search-result-title">
                  <h3>{provider.name}</h3>
                  {provider.sponsored ? (
                    <div className="sponsored-cluster">
                      <span className="result-badge">Sponsored</span>
                      <details className="sponsored-explainer">
                        <summary className="sponsored-explainer__summary">Why am I seeing this?</summary>
                        <div className="sponsored-explainer__body">
                          Sponsored businesses can receive a placement boost, but only when they
                          still match your address, service type, and service radius.
                        </div>
                      </details>
                    </div>
                  ) : null}
                </div>
                <p>
                  {provider.eta} • {provider.rating} stars • Next slot {provider.nextSlot}
                </p>
                <p>
                  Timeliness 4.8 • Attention to detail 4.9
                  {provider.sponsored
                    ? " • Paid promotion can improve placement, but only within relevant service and radius matches."
                    : ""}
                </p>
                <div className="cta-row">
                  <a className="button-secondary" href="#payment-protection">
                    Book selected slot
                  </a>
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="card">
          <h2>Quote checks</h2>
          <ul className="timeline">
            <li>
              <strong>1</strong>
              <span>High confidence: instant price and timing.</span>
            </li>
            <li>
              <strong>2</strong>
              <span>Medium confidence: a couple quick follow-ups.</span>
            </li>
            <li>
              <strong>3</strong>
              <span>Low confidence: provider review before booking.</span>
            </li>
          </ul>
        </article>
      </section>

      <section className="grid-two" id="payment-protection">
        <article className="card">
          <h2>Scheduling</h2>
          <ul className="timeline">
            <li>
              <strong>1</strong>
              <span>Pick a time window that fits the job.</span>
            </li>
            <li>
              <strong>2</strong>
              <span>Bookings update the landscaper right away.</span>
            </li>
            <li>
              <strong>3</strong>
              <span>Reminders go out before and after service.</span>
            </li>
          </ul>
        </article>

        <article className="card">
          <h2>Payments and refunds</h2>
          <p>Pay at booking. Open a refund request if there is a no-show or service issue.</p>
          <div className="chip-row">
            <span>Authorized at booking</span>
            <span>Refund review tied to booking</span>
            <span>Support-assisted resolution</span>
          </div>
          <div className="cta-row" style={{ marginTop: "1rem" }}>
            <a className="button" href="/help">
              Open billing or quality issue
            </a>
          </div>
        </article>
      </section>

      <section className="grid-two">
        <article className="card">
          <h2>Saved properties</h2>
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            <article className="list-panel">
              <h3>Primary home</h3>
              <p>112 Garden Row, Austin, TX 78704 • Default booking address</p>
            </article>
            <article className="list-panel">
              <h3>Rental property</h3>
              <p>55 Barton Creek Ln, Austin, TX 78735 • Available for one-tap booking</p>
            </article>
          </div>
        </article>

        <article className="card">
          <h2>Booked the wrong address?</h2>
          <ul className="timeline">
            <li>
              <strong>1</strong>
              <span>If it is still requested, you can update it right away.</span>
            </li>
            <li>
              <strong>2</strong>
              <span>If it is confirmed and more than 24 hours out, the provider reviews it first.</span>
            </li>
            <li>
              <strong>3</strong>
              <span>If it is too close to service time or out of range, support takes over.</span>
            </li>
          </ul>
        </article>
      </section>

      <section className="grid-two">
        <article className="card">
          <h2>Completed bookings waiting on review</h2>
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            {reviewOpportunities.map((item) => (
              <article className="list-panel" key={item.bookingId}>
                <h3>
                  {item.bookingId} • {item.providerName}
                </h3>
                <p>{item.completedAt}</p>
                <p>
                  <strong>{item.statusLabel}</strong> • {item.detail}
                </p>
                <div className="cta-row">
                  <button
                    className={item.cta === "Review this booking" ? "button" : "button-secondary"}
                    type="button"
                  >
                    {item.cta}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="card">
          <h2>Review timing</h2>
          <ul className="timeline">
            <li>
              <strong>1</strong>
              <span>The job is marked complete.</span>
            </li>
            <li>
              <strong>2</strong>
              <span>Your review invite goes out 48 hours later.</span>
            </li>
            <li>
              <strong>3</strong>
              <span>Each booking can be reviewed once.</span>
            </li>
          </ul>
          <p>Reviews open after service.</p>
        </article>
      </section>
    </main>
  );
}
