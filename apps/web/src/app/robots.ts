import type { MetadataRoute } from "next";
import { buildSiteUrl, internalRobotsDisallowPaths } from "../lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...internalRobotsDisallowPaths]
      }
    ],
    sitemap: buildSiteUrl("/sitemap.xml")
  };
}
