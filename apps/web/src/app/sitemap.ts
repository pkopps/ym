import type { MetadataRoute } from "next";
import { addLocalePrefix } from "@yardmatch/i18n";
import { buildSiteUrl, launchSeoPaths } from "../lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return launchSeoPaths.flatMap((page) => [
    {
      url: buildSiteUrl(page.path),
      lastModified,
      changeFrequency: page.changeFrequency,
      priority: page.priority
    },
    {
      url: buildSiteUrl(addLocalePrefix(page.path, "es")),
      lastModified,
      changeFrequency: page.changeFrequency,
      priority: Math.max(page.priority - 0.05, 0.1)
    }
  ]);
}
