import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginCard } from "../../../components/LoginCard";
import { getLocalizedPageMetadata, getRequestI18n } from "../../../lib/i18n-server";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/login/ops",
    titleKey: "login_card.staff_title"
  });
}

export default async function OpsLoginPage() {
  const i18n = await getRequestI18n();

  return (
    <main className="container login-page">
      <h1>{i18n.t("login_card.staff_title")}</h1>
      <Suspense fallback={null}>
        <LoginCard audience="staff" />
      </Suspense>
    </main>
  );
}
