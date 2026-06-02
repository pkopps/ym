import type { Metadata } from "next";
import { RoleLoginCard } from "../../../components/RoleLoginCard";

export const metadata: Metadata = {
  title: "Customer login"
};

export default function CustomerLoginPage() {
  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <h1>Log in to your customer account.</h1>
        <p>Manage bookings, properties, and reviews.</p>
      </section>
      <RoleLoginCard role="customer" />
    </main>
  );
}
