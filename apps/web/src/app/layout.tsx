import type { Metadata } from "next";
import { ObservabilityProvider } from "../components/ObservabilityProvider";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { publicSiteUrl } from "../lib/site";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "YardMatch | Book trusted lawn care and landscaping",
    template: "%s | YardMatch"
  },
  description:
    "YardMatch helps customers book vetted lawn care and landscaping professionals while giving business owners and crew members separate apps for schedules, staffing, payments, assignments, and support.",
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
  openGraph: {
    title: "YardMatch",
    description: "Book trusted lawn care and landscaping professionals in minutes.",
    url: publicSiteUrl,
    siteName: "YardMatch",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "YardMatch",
    description: "The appointment marketplace for lawn care and landscaping."
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ObservabilityProvider />
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
