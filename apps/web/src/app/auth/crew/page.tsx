import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crew member sign up"
};

export default function CrewSignupPage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">Crew member sign up</span>
        <h1>Create your crew profile.</h1>
        <p>Join local crews and manage your work.</p>
      </section>

      <section className="card">
        <div className="form-grid">
          <label className="form-field">
            <span>Full name</span>
            <input placeholder="Miles Carter" />
          </label>
          <label className="form-field">
            <span>Email</span>
            <input placeholder="miles@example.com" />
          </label>
          <label className="form-field form-field--full">
            <span>Home base</span>
            <input placeholder="4012 River Bend Dr, Tampa, FL 33602" />
          </label>
          <label className="form-field">
            <span>Preferred schedule</span>
            <select defaultValue="flex">
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
              <option value="seasonal">Seasonal</option>
              <option value="flex">Flexible</option>
            </select>
          </label>
          <label className="form-field">
            <span>Travel radius</span>
            <input placeholder="20 miles" />
          </label>
          <label className="form-field form-field--full">
            <span>Skills</span>
            <input placeholder="Lawn mowing, hedge trimming, leaf blowing" />
          </label>
        </div>
        <div className="cta-row" style={{ marginTop: "1rem" }}>
          <a className="button" href="/crew">
            Create account
          </a>
          <a className="button-secondary" href="/auth">
            Back
          </a>
        </div>
      </section>
    </main>
  );
}
