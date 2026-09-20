import { Suspense } from "react";
import { AnalyticsPreferences } from "../components/AnalyticsPreferences";
import type { Metadata } from "next";
import { sourceMessages } from "@yardmatch/i18n";
import { I18nProvider } from "@yardmatch/i18n/react";
import { ObservabilityProvider } from "../components/ObservabilityProvider";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { getRequestLocale, getRequestMessages, localeToHtmlLang } from "../lib/i18n-server";
import { publicSiteUrl } from "../lib/site";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: sourceMessages["metadata.default.title"],
    template: "%s | YardMatch"
  },
  description: sourceMessages["metadata.default.description"],
  keywords: [
    "lawn care marketplace",
    "landscaper booking app",
    "schedule lawn mowing",
    "landscaping providers",
    "yard services platform",
    "landscaping crew app",
    "landscaper staffing marketplace"
  ],
  metadataBase: new URL(`${publicSiteUrl}/`),
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION?.trim() || undefined
  },
  openGraph: {
    title: sourceMessages["metadata.og.title"],
    description: sourceMessages["metadata.og.description"],
    url: publicSiteUrl,
    siteName: sourceMessages["metadata.og.site_name"],
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: sourceMessages["metadata.twitter.title"],
    description: sourceMessages["metadata.twitter.description"]
  }
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getRequestLocale();
  const { messages, fallbackMessages } = await getRequestMessages(locale);

  return (
    <html lang={localeToHtmlLang(locale)}>
      <body>
        <I18nProvider fallbackMessages={fallbackMessages} locale={locale} messages={messages}>
          <Suspense fallback={null}><ObservabilityProvider /></Suspense>
          <SiteHeader />
          <div id="main-content" tabIndex={-1}>{children}</div>
          <SiteFooter />
          <AnalyticsPreferences />
        </I18nProvider>
      </body>
    </html>
  );
}
