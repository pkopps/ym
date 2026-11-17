import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginCard } from "../../components/LoginCard";
import { getLocalizedPageMetadata, getRequestI18n } from "../../lib/i18n-server";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/login",
    titleKey: "nav.log_in"
  });
}

export default async function LoginPage() {
  const i18n = await getRequestI18n();

  return (
    <main className="container login-page">
      <h1>{i18n.t("nav.log_in")}</h1>
      <Suspense fallback={null}>
        <LoginCard audience="member" />
      </Suspense>
    </main>
  );
}
