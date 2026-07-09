import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountSignupForm } from "../../../components/AccountSignupForm";
import { LoadingScreen } from "../../../components/LoadingScreen";

export const metadata: Metadata = {
  title: "Customer sign up"
};

export default function CustomerSignupPage() {
  return (
    <main className="container stack-lg auth-signup-page">
      <section className="auth-page-header">
        <span className="eyebrow">Customer account</span>
        <h1>Finish your request.</h1>
        <p>Save the service address and continue with the selected match.</p>
      </section>

      <Suspense fallback={<LoadingScreen label="Loading signup..." />}>
        <AccountSignupForm role="customer" />
      </Suspense>
    </main>
  );
}
