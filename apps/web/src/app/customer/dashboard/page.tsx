import type { Metadata } from "next";
import { CustomerLiveDashboard } from "../../../components/CustomerLiveDashboard";

export const metadata: Metadata = {
  title: "Customer dashboard",
  description: "Book live services, manage bookings, and submit post-service reviews."
};

export default function CustomerDashboardPage() {
  return <CustomerLiveDashboard />;
}
