import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountSignupForm } from "../../../components/AccountSignupForm";
import { LoadingScreen } from "../../../components/LoadingScreen";
import { getLocalizedPageMetadata, getRequestI18n } from "../../../lib/i18n-server";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/auth/customer",
    titleKey: "auth_customer.metadata.title"
  });
}

export default async function CustomerSignupPage() {
  const i18n = await getRequestI18n();

  return (
    <main className="container stack-lg auth-signup-page">
      <section className="auth-page-header">
        <h1>{i18n.t("auth_customer.title")}</h1>
      </section>

      <Suspense fallback={<LoadingScreen label={i18n.t("auth_signup.loading")} />}>
        <AccountSignupForm role="customer" />
      </Suspense>
    </main>
  );
}
