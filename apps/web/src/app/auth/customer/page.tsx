import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customer sign up"
};

export default function CustomerSignupPage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">Property owner sign up</span>
        <h1>Create your customer account.</h1>
        <p>Book and manage service for your property.</p>
      </section>

      <section className="card">
        <div className="form-grid">
          <label className="form-field">
            <span>Full name</span>
            <input placeholder="Jordan Rivera" />
          </label>
          <label className="form-field">
            <span>Email</span>
            <input placeholder="jordan@example.com" />
          </label>
          <label className="form-field form-field--full">
            <span>Property address</span>
            <input placeholder="112 Garden Row, Austin, TX 78704" />
          </label>
          <label className="form-field">
            <span>Property label</span>
            <input placeholder="Primary home" />
          </label>
          <label className="form-field">
            <span>Service need</span>
            <select defaultValue="lawn-mowing">
              <option value="lawn-mowing">Lawn mowing</option>
              <option value="seasonal-cleanup">Seasonal cleanup</option>
              <option value="weed-control">Weed control</option>
              <option value="leaf-blowing">Leaf blowing</option>
              <option value="gutter-cleaning">Gutter cleaning</option>
              <option value="snow-shoveling">Snow shoveling</option>
            </select>
          </label>
          <label className="form-field form-field--full">
            <span>Access notes</span>
            <input placeholder="Side gate on the left, code 1842" />
          </label>
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
