import type { Metadata } from "next";
import { SignupIdentityOptions } from "../../../../components/SignupIdentityOptions";

export const metadata: Metadata = {
  title: "Create your business account"
};

export default function ProviderSignupCreatePage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">Business owner sign up</span>
        <h1>Create your business account.</h1>
        <p>We&apos;ll collect company, address, and radius details next.</p>
      </section>

      <section className="card">
        <div className="auth-form-stack">
          <div className="form-grid">
            <label className="form-field form-field--full">
              <span>Email</span>
              <input placeholder="crewlead@greenstride.example" />
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
          <p className="auth-helper">Business setup and service radius come next.</p>
          <SignupIdentityOptions role="provider" />
        </div>
        <div className="cta-row" style={{ marginTop: "1rem" }}>
          <a className="button" href="/provider">
            Create account
          </a>
          <a className="button-secondary" href="/auth/provider">
            Back
          </a>
        </div>
      </section>
    </main>
  );
}
