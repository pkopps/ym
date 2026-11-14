import type { Metadata } from "next";
import { addLocalePrefix, type TranslationKey } from "@yardmatch/i18n";
import { getLocalizedPageMetadata, getRequestI18n } from "../../lib/i18n-server";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/auth",
    titleKey: "auth_choice.metadata.title"
  });
}

const choices = [
  {
    href: "/auth/customer",
    titleKey: "auth_choice.customer.title"
  },
  {
    href: "/auth/provider/create",
    titleKey: "auth_choice.provider.title"
  },
  {
    href: "/auth/crew",
    titleKey: "auth_choice.crew.title"
  }
] satisfies Array<{ href: string; titleKey: TranslationKey }>;

export default async function AuthPage() {
  const i18n = await getRequestI18n();

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <h1>{i18n.t("auth_choice.title")}</h1>
      </section>

      <section className="grid-three auth-choice-grid">
        {choices.map((choice) => (
          <article className="card" key={choice.href}>
            <h2>{i18n.t(choice.titleKey)}</h2>
            <div className="cta-row">
              <a className="button" href={addLocalePrefix(choice.href, i18n.locale)}>
                {i18n.t("common.actions.continue")}
              </a>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
