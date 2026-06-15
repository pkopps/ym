import type { Metadata } from "next";
import { SignupIdentityOptions } from "../../../components/SignupIdentityOptions";

export const metadata: Metadata = {
  title: "Crew member sign up"
};

export default function CrewSignupPage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">Crew member sign up</span>
        <h1>Create your crew profile.</h1>
        <p>We&apos;ll collect skills and travel preferences next.</p>
      </section>

      <section className="card">
        <div className="auth-form-stack">
          <div className="form-grid">
            <label className="form-field form-field--full">
              <span>Email</span>
              <input placeholder="you@example.com" />
            </label>
            <label className="form-field">
              <span>Password</span>
              <input type="password" placeholder="Create a password" />
            </label>
            <label className="form-field">
              <span>Confirm password</span>
              <input type="password" placeholder="Re-enter password" />
            </label>
          </div>
          <p className="auth-helper">Skills, travel radius, and schedule preferences come next.</p>
          <SignupIdentityOptions role="crew-member" />
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
