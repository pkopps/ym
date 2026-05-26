import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customer login"
};

export default function CustomerLoginPage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">Customer login</span>
        <h1>Log in to your customer account.</h1>
        <p>Manage bookings, properties, and reviews.</p>
      </section>

      <section className="card">
        <div className="form-grid">
          <label className="form-field">
            <span>Email</span>
            <input placeholder="customer@example.com" />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input type="password" placeholder="••••••••" />
          </label>
        </div>
        <div className="cta-row" style={{ marginTop: "1rem" }}>
          <a className="button" href="/customer">
            Log in
          </a>
          <a className="button-secondary" href="/login">
            Back
          </a>
        </div>
      </section>
    </main>
  );
}
