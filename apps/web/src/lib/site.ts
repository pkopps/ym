const FALLBACK_SITE_URL = "http://localhost:3000";
const FALLBACK_LAUNCH_AREA_LABEL = "Barnegat, NJ";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export const publicSiteUrl = trimTrailingSlash(
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || FALLBACK_SITE_URL
);

export const launchAreaLabel =
  process.env.NEXT_PUBLIC_DEFAULT_SERVICE_AREA_LABEL?.trim() || FALLBACK_LAUNCH_AREA_LABEL;

export const noIndexRobots = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false
  }
} as const;

export const launchSeoPaths = [
  {
    path: "/",
    changeFrequency: "weekly" as const,
    priority: 1
  },
  {
    path: "/barnegat-nj",
    changeFrequency: "weekly" as const,
    priority: 0.95
  },
  {
    path: "/barnegat-nj/lawn-mowing",
    changeFrequency: "weekly" as const,
    priority: 0.9
  },
  {
    path: "/barnegat-nj/yard-cleanup",
    changeFrequency: "weekly" as const,
    priority: 0.9
  },
  {
    path: "/services/lawn-mowing",
    changeFrequency: "weekly" as const,
    priority: 0.8
  },
  {
    path: "/services/yard-cleanup",
    changeFrequency: "weekly" as const,
    priority: 0.8
  },
  {
    path: "/about",
    changeFrequency: "monthly" as const,
    priority: 0.7
  },
  {
    path: "/help",
    changeFrequency: "weekly" as const,
    priority: 0.6
  },
  {
    path: "/support",
    changeFrequency: "monthly" as const,
    priority: 0.65
  },
  {
    path: "/cancellation-policy",
    changeFrequency: "monthly" as const,
    priority: 0.6
  },
  {
    path: "/refund-policy",
    changeFrequency: "monthly" as const,
    priority: 0.6
  },
  {
    path: "/booking-expectations",
    changeFrequency: "monthly" as const,
    priority: 0.65
  },
  {
    path: "/provider-verification",
    changeFrequency: "monthly" as const,
    priority: 0.65
  },
  {
    path: "/privacy-policy",
    changeFrequency: "monthly" as const,
    priority: 0.55
  },
  {
    path: "/terms-of-service",
    changeFrequency: "monthly" as const,
    priority: 0.55
  },
  {
    path: "/provider-standards",
    changeFrequency: "monthly" as const,
    priority: 0.6
  },
  {
    path: "/provider",
    changeFrequency: "weekly" as const,
    priority: 0.6
  }
] as const;

export const internalRobotsDisallowPaths = [
  "/auth/",
  "/login/",
  "/customer/dashboard",
  "/customer/history",
  "/customer/listings",
  "/provider/management",
  "/provider/clients",
  "/provider/payments",
  "/provider/partnerships",
  "/crew/schedule",
  "/ops/"
] as const;

export function buildSiteUrl(path = "/") {
  return new URL(path, `${publicSiteUrl}/`).toString();
}
