import type { Metadata } from "next";
import { Suspense } from "react";
import { CustomerLiveDashboard } from "../../../components/CustomerLiveDashboard";
import { LoadingScreen } from "../../../components/LoadingScreen";

export const metadata: Metadata = {
  title: "Customer dashboard",
  description: "Book live services, manage bookings, and submit post-service reviews."
};

export default function CustomerDashboardPage() {
  return (
    <Suspense fallback={<LoadingScreen label="Loading customer dashboard..." />}>
      <CustomerLiveDashboard />
    </Suspense>
  );
}
