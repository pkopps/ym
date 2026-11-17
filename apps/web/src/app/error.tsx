"use client";

import { useEffect } from "react";
import { PageErrorState } from "../components/PageErrorState";
import { captureProductEvent } from "../lib/productAnalytics";

// Without this boundary a rendering failure shows Next.js's bare "Application error" screen.
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    captureProductEvent("client_error", { reason: "route-error-boundary" });
  }, [error]);

  return (
    <PageErrorState
      titleKey="app_error.title"
      bodyKey="app_error.body"
      reference={error.digest}
      onRetry={reset}
    />
  );
}
