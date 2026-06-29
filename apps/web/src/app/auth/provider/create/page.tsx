import type { Metadata } from "next";
import { AccountSignupForm } from "../../../../components/AccountSignupForm";

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

      <AccountSignupForm role="provider" />
    </main>
  );
}
