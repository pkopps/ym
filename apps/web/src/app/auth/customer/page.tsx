import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountSignupForm } from "../../../components/AccountSignupForm";
import { LoadingScreen } from "../../../components/LoadingScreen";

export const metadata: Metadata = {
  title: "Customer sign up"
};

export default function CustomerSignupPage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">Property owner sign up</span>
        <h1>Create your customer account.</h1>
        <p>Add your contact and service address so you can request or manage yard care.</p>
      </section>

      <Suspense fallback={<LoadingScreen label="Loading signup..." />}>
        <AccountSignupForm role="customer" />
      </Suspense>
    </main>
  );
}
