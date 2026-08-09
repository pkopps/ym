export const dynamic = "force-dynamic";

export async function GET() {
  const hosted = Boolean(process.env.VERCEL);
  const environment = process.env.YARDMATCH_ENV?.trim() || (hosted ? "unconfigured" : "local");
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";
  const validEnvironment = ["local", "staging", "production"].includes(environment);
  const validApiTarget = environment === "local"
    ? apiBaseUrl.startsWith("http://") || apiBaseUrl.startsWith("https://")
    : apiBaseUrl.startsWith("https://");
  const ready = validEnvironment && validApiTarget;

  return Response.json(
    {
      status: ready ? "ok" : "misconfigured",
      environment,
      apiConfigured: validApiTarget,
      revision: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
