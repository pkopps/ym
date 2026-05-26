import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    "",
    "/auth",
    "/auth/customer",
    "/auth/provider",
    "/auth/crew",
    "/login",
    "/login/customer",
    "/login/provider",
    "/login/crew",
    "/customer",
    "/provider",
    "/crew",
    "/help"
  ];
  return pages.map((path) => ({
    url: `https://yardmatch.example${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.8
  }));
}
