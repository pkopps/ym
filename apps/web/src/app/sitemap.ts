import type { MetadataRoute } from "next";
import { buildSiteUrl, launchSeoPaths } from "../lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return launchSeoPaths.map((page) => ({
    url: buildSiteUrl(page.path),
    lastModified: new Date(),
    changeFrequency: page.changeFrequency,
    priority: page.priority
  }));
}
