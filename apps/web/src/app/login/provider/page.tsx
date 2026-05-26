import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Business owner login"
};

export default function ProviderLoginPage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">Business owner login</span>
        <h1>Log in to your business account.</h1>
        <p>Manage schedules, clients, crews, and payouts.</p>
      </section>

      <section className="card">
        <div className="form-grid">
          <label className="form-field">
            <span>Email</span>
            <input placeholder="crewlead@greenstride.example" />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input type="password" placeholder="••••••••" />
          </label>
        </div>
        <div className="cta-row" style={{ marginTop: "1rem" }}>
          <a className="button" href="/provider">
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
