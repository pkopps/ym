import { Suspense } from "react";
import type { Metadata } from "next";
import { CustomerReferralsPanel } from "../../../components/CustomerReferralsPanel";
import { getRequestI18n } from "../../../lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getRequestI18n();
  return { title: i18n.t("referrals.title"), robots: { index: false, follow: false } };
}

export default function CustomerReferralsPage() {
  return <Suspense><CustomerReferralsPanel /></Suspense>;
}
