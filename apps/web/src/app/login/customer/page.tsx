import type { Metadata } from "next";
import { AuthIdentityOptions } from "../../../components/SignupIdentityOptions";

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
        <div className="auth-form-stack">
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
          <AuthIdentityOptions mode="login" role="customer" />
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
