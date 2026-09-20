import { HttpError, type RequestContext } from "../http";
export const mobileApps = ["customer", "provider", "crew"] as const;
export function compareVersions(left: string, right: string) {
  const valid = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
  if (!valid.test(left) || !valid.test(right)) throw new HttpError(400, "Invalid mobile version");
  const a = left.split(".").map(Number), b = right.split(".").map(Number);
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
}
export function mobileReleasePolicy(app: string) {
  if (!mobileApps.includes(app as typeof mobileApps[number])) throw new HttpError(400, "Unknown mobile app");
  const minimumVersion = process.env[`MINIMUM_${app.toUpperCase()}_MOBILE_VERSION`] ?? "0.1.0";
  compareVersions(minimumVersion, minimumVersion);
  return {app, minimumVersion, maintenance: process.env[`PAUSE_${app.toUpperCase()}_MOBILE`] === "1"};
}
export function enforceMobileRelease(context: RequestContext) {
  if (context.path === "/api/mobile/release-policy" || ["/healthz", "/readyz"].includes(context.path)) return;
  const app = context.headers["x-yardmatch-app"];
  if (!app) return;
  const policy = mobileReleasePolicy(app);
  if (policy.maintenance) throw new HttpError(503, "This app is temporarily paused. Please try again shortly.");
  if (compareVersions(context.headers["x-yardmatch-app-version"] ?? "", policy.minimumVersion) < 0) {
    throw new HttpError(426, "Update YardMatch to continue safely.");
  }
}
