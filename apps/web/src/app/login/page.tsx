import type { Metadata } from "next";
import { addLocalePrefix, type TranslationKey } from "@yardmatch/i18n";
import { getLocalizedPageMetadata, getRequestI18n } from "../../lib/i18n-server";

export function generateMetadata(): Promise<Metadata> {
  return getLocalizedPageMetadata({
    path: "/login",
    titleKey: "login_choice.metadata.title"
  });
}

const choices = [
  {
    href: "/login/customer",
    titleKey: "login_choice.customer.title",
    bodyKey: "login_choice.customer.body"
  },
  {
    href: "/login/provider",
    titleKey: "login_choice.provider.title",
    bodyKey: "login_choice.provider.body"
  },
  {
    href: "/login/crew",
    titleKey: "login_choice.crew.title",
    bodyKey: "login_choice.crew.body"
  }
] satisfies Array<{ href: string; titleKey: TranslationKey; bodyKey: TranslationKey }>;

export default async function LoginPage() {
  const i18n = await getRequestI18n();

  return (
    <main className="container stack-lg">
      <section className="page-hero">
        <span className="eyebrow">{i18n.t("login_choice.eyebrow")}</span>
        <h1>{i18n.t("login_choice.title")}</h1>
        <p>{i18n.t("login_choice.body")}</p>
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
