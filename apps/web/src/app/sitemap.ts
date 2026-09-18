import type { MetadataRoute } from "next";
import { addLocalePrefix } from "@yardmatch/i18n";
import { buildSiteUrl, launchSeoPaths } from "../lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  // Omit lastModified until we have real per-page content revision dates.
  return launchSeoPaths.flatMap((page) => [
    {
      url: buildSiteUrl(page.path),
      alternates: {
        languages: {
          en: buildSiteUrl(page.path),
          es: buildSiteUrl(addLocalePrefix(page.path, "es")),
          "x-default": buildSiteUrl(page.path)
        }
      },
      changeFrequency: page.changeFrequency,
      priority: page.priority
    },
    {
      url: buildSiteUrl(addLocalePrefix(page.path, "es")),
      alternates: {
        languages: {
          en: buildSiteUrl(page.path),
          es: buildSiteUrl(addLocalePrefix(page.path, "es")),
          "x-default": buildSiteUrl(page.path)
        }
      },
      changeFrequency: page.changeFrequency,
      priority: Math.max(page.priority - 0.05, 0.1)
    }
  ]);
}
