import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign up"
};

export default function AuthPage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">Sign up</span>
        <h1>Choose your account.</h1>
        <p>Pick the role that fits you.</p>
      </section>

      <section className="grid-three auth-choice-grid">
        <article className="card">
          <h2>Property owner</h2>
          <p>Book and manage service for your home or property.</p>
          <div className="cta-row">
            <a className="button" href="/auth/customer">
              Continue
            </a>
          </div>
        </article>

        <article className="card">
          <h2>Business owner</h2>
          <p>Bring in more local jobs and run your operation in one place.</p>
          <div className="cta-row">
            <a className="button" href="/auth/provider">
              Continue
            </a>
          </div>
        </article>

        <article className="card">
          <h2>Crew member</h2>
          <p>Join landscaping crews and manage your assignments.</p>
          <div className="cta-row">
            <a className="button" href="/auth/crew">
              Continue
            </a>
          </div>
        </article>
      </section>
    </main>
  );
}
