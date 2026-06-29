import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountSignupForm } from "../../../../components/AccountSignupForm";
import { LoadingScreen } from "../../../../components/LoadingScreen";

export const metadata: Metadata = {
  title: "Create your business account"
};

export default function ProviderSignupCreatePage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">Business owner sign up</span>
        <h1>Create your business account.</h1>
        <p>Add your company, address, and service radius so YardMatch can create your provider profile.</p>
      </section>

      <Suspense fallback={<LoadingScreen label="Loading signup..." />}>
        <AccountSignupForm role="provider" />
      </Suspense>
    </main>
  );
}
