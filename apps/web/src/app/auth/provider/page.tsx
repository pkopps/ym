import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Business owner sign up"
};

export default function ProviderSignupPage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">Business owner sign up</span>
        <h1>Create your business account.</h1>
        <p>Start bringing in more local jobs.</p>
      </section>

      <section className="card">
        <div className="form-grid">
          <label className="form-field">
            <span>Owner name</span>
            <input placeholder="Ariana Fields" />
          </label>
          <label className="form-field">
            <span>Company name</span>
            <input placeholder="GreenStride Lawn Co." />
          </label>
          <label className="form-field form-field--full">
            <span>Service address</span>
            <input placeholder="145 Prospect Ave, Brooklyn, NY 11215" />
          </label>
          <label className="form-field">
            <span>Service radius</span>
            <input placeholder="20 miles" />
          </label>
          <label className="form-field">
            <span>Calendar</span>
            <select defaultValue="google">
              <option value="google">Google Calendar</option>
              <option value="apple">Apple Calendar</option>
              <option value="outlook">Outlook</option>
            </select>
          </label>
        </div>
        <div className="cta-row" style={{ marginTop: "1rem" }}>
          <a className="button" href="/provider">
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
