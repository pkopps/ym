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
    titleKey: "auth_choice.customer.title",
    bodyKey: "auth_choice.customer.body"
  },
  {
    href: "/auth/provider/create",
    titleKey: "auth_choice.provider.title",
    bodyKey: "auth_choice.provider.body"
  },
  {
    href: "/auth/crew",
    titleKey: "auth_choice.crew.title",
    bodyKey: "auth_choice.crew.body"
  }
] satisfies Array<{ href: string; titleKey: TranslationKey; bodyKey: TranslationKey }>;

export default async function AuthPage() {
  const i18n = await getRequestI18n();

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">{i18n.t("auth_choice.eyebrow")}</span>
        <h1>{i18n.t("auth_choice.title")}</h1>
        <p>{i18n.t("auth_choice.body")}</p>
      </section>

      <section className="grid-three auth-choice-grid">
        {choices.map((choice) => (
          <article className="card" key={choice.href}>
            <h2>{i18n.t(choice.titleKey)}</h2>
            <p>{i18n.t(choice.bodyKey)}</p>
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
