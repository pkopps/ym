import type { MetadataRoute } from "next";
import { addLocalePrefix } from "@yardmatch/i18n";
import { buildSiteUrl, internalRobotsDisallowPaths } from "../lib/site";

export default function robots(): MetadataRoute.Robots {
  const localizedInternalPaths = internalRobotsDisallowPaths.map((path) => addLocalePrefix(path, "es"));

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...internalRobotsDisallowPaths, ...localizedInternalPaths]
      }
    ],
    sitemap: buildSiteUrl("/sitemap.xml")
  };
}
