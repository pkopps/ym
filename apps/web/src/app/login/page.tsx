import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log in"
};

export default function LoginPage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">Log in</span>
        <h1>Choose your role.</h1>
        <p>One website. Three paths.</p>
      </section>

      <section className="grid-three auth-choice-grid">
        <article className="card">
          <h2>Customer</h2>
          <p>For homes and properties.</p>
          <div className="cta-row">
            <a className="button" href="/login/customer">
              Continue
            </a>
          </div>
        </article>

        <article className="card">
          <h2>Business owner</h2>
          <p>For landscaping businesses.</p>
          <div className="cta-row">
            <a className="button" href="/login/provider">
              Continue
            </a>
          </div>
        </article>

        <article className="card">
          <h2>Crew member</h2>
          <p>For crew members.</p>
          <div className="cta-row">
            <a className="button" href="/login/crew">
              Continue
            </a>
          </div>
        </article>
      </section>
    </main>
  );
}
