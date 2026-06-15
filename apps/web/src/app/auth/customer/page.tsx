import type { Metadata } from "next";
import { SignupIdentityOptions } from "../../../components/SignupIdentityOptions";

export const metadata: Metadata = {
  title: "Customer sign up"
};

export default function CustomerSignupPage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">Property owner sign up</span>
        <h1>Create your customer account.</h1>
        <p>We&apos;ll collect property details after signup.</p>
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
          <p className="auth-helper">Address and service setup come next.</p>
          <SignupIdentityOptions role="customer" />
        </div>
        <div className="cta-row" style={{ marginTop: "1rem" }}>
          <a className="button" href="/customer">
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
