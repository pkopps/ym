import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Service history",
  description: "Review past YardMatch services, providers, crew notes, and billing outcomes."
};

const serviceHistory = [
  {
    id: "YM-HIST-4102",
    service: "Weekly mow and edge",
    property: "Primary home",
    address: "220 Willow St, Nashville, TN 37206",
    provider: "GreenStride Lawn Co.",
    completedAt: "Completed May 9, 2026",
    crew: "Ariana Fields + 2 crew members",
    price: "$68",
    outcome: "Paid and completed"
  },
  {
    id: "YM-HIST-3988",
    service: "Mulch refresh and bed cleanup",
    property: "Rental property",
    address: "55 Barton Creek Ln, Austin, TX 78735",
    provider: "TerraCut Studio",
    completedAt: "Completed Apr 27, 2026",
    crew: "Luis Ortega + 1 crew member",
    price: "$182",
    outcome: "Paid and completed"
  },
  {
    id: "YM-HIST-3840",
    service: "Spring irrigation inspection",
    property: "Primary home",
    address: "220 Willow St, Nashville, TN 37206",
    provider: "Cedarstone Landscaping",
    completedAt: "Completed Apr 11, 2026",
    crew: "Nina Brooks",
    price: "$94",
    outcome: "Completed and up to date"
  }
];

export default function CustomerHistoryPage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">Service history</span>
        <h1>Past services in one place.</h1>
        <p>See what was done and who did it.</p>
      </section>

      <section className="stack-lg">
        {serviceHistory.map((item) => (
          <article className="history-card" key={item.id}>
            <div className="history-card__header">
              <div>
                <span className="eyebrow">{item.property}</span>
                <h2>{item.service}</h2>
              </div>
              <strong>{item.outcome}</strong>
            </div>
            <div className="history-card__grid">
              <div>
                <h3>Booking</h3>
                <p>{item.id}</p>
                <p>{item.completedAt}</p>
              </div>
              <div>
                <h3>Completed by</h3>
                <p>{item.provider}</p>
                <p>{item.crew}</p>
              </div>
              <div>
                <h3>Property</h3>
                <p>{item.address}</p>
                <p>{item.price}</p>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
