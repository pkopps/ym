import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crew member login"
};

export default function CrewLoginPage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">Crew member login</span>
        <h1>Log in to your crew account.</h1>
        <p>Check openings, schedules, and past work.</p>
      </section>

      <section className="card">
        <div className="form-grid">
          <label className="form-field">
            <span>Email</span>
            <input placeholder="crew.member@example.com" />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input type="password" placeholder="••••••••" />
          </label>
        </div>
        <div className="cta-row" style={{ marginTop: "1rem" }}>
          <a className="button" href="/crew">
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
