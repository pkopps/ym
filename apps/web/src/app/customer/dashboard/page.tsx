import type { Metadata } from "next";
import { Suspense } from "react";
import { CustomerLiveDashboard } from "../../../components/CustomerLiveDashboard";
import { LoadingScreen } from "../../../components/LoadingScreen";
import { getLocalizedPageMetadata, getRequestI18n } from "../../../lib/i18n-server";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/customer/dashboard",
    titleKey: "customer_dashboard.metadata.title",
    descriptionKey: "customer_dashboard.metadata.description"
  });
}

export default async function CustomerDashboardPage() {
  const i18n = await getRequestI18n();
  return (
    <Suspense fallback={<LoadingScreen label={i18n.t("customer_dashboard.loading")} />}>
      <CustomerLiveDashboard />
    </Suspense>
  );
}
