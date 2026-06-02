import type { Metadata } from "next";
import { RoleLoginCard } from "../../../components/RoleLoginCard";

export const metadata: Metadata = {
  title: "Business owner login"
};

export default function ProviderLoginPage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <h1>Log in to your business account.</h1>
        <p>Manage schedules, clients, crews, and payouts.</p>
      </section>
      <RoleLoginCard role="provider" />
    </main>
  );
}
