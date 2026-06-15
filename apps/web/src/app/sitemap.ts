import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    "",
    "/about",
    "/auth",
    "/auth/customer",
    "/auth/provider",
    "/auth/provider/create",
    "/auth/crew",
    "/login",
    "/login/customer",
    "/login/provider",
    "/login/crew",
    "/customer",
    "/provider",
    "/provider/management",
    "/provider/payments",
    "/provider/partnerships",
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
