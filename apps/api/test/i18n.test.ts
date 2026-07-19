import assert from "node:assert/strict";
import test from "node:test";
import type { ProviderCalendarOverviewResponse } from "@yardmatch/contracts";
import {
  localizeApiErrorMessage,
  localizeProviderCalendarOverview,
  resolveApiLocale
} from "../src/i18n";

test("resolveApiLocale prefers X-YardMatch-Locale and falls back to Accept-Language", () => {
  assert.equal(
    resolveApiLocale({
      "x-yardmatch-locale": "es",
      "accept-language": "en-US"
    }),
    "es"
  );
  assert.equal(
    resolveApiLocale({
      "accept-language": "fr-CA, es-US;q=0.8"
    }),
    "es"
  );
});

test("localizeApiErrorMessage translates known API errors without changing unknown details", async () => {
  assert.equal(
    await localizeApiErrorMessage("Invalid email or password", {
      "x-yardmatch-locale": "es"
    }),
    "Correo o contrasena no validos"
  );
  assert.equal(
    await localizeApiErrorMessage("Some provider-specific failure", {
      "x-yardmatch-locale": "es"
    }),
    "Some provider-specific failure"
  );
});

test("localizeProviderCalendarOverview localizes labels while preserving window keys", async () => {
  const overview: ProviderCalendarOverviewResponse = {
    providerId: "provider_1",
    providerName: "GreenStride",
    windowStartIso: "2026-07-15T00:00:00.000Z",
    windowEndIso: "2026-07-16T00:00:00.000Z",
    totalEvents: 0,
    yardmatchJobCount: 0,
    externalBlockCount: 0,
    syncHealth: {
      status: "healthy",
      externalBlockingEnabled: true,
      subscriptionCount: 0,
      activeSubscriptionCount: 0,
      erroredSubscriptionCount: 0,
      staleSubscriptionCount: 0,
      importedBlockCount: 0,
      manualBlockCount: 0,
      upcomingExternalBlockCount: 0,
      conflictingYardmatchJobCount: 0,
      notes: []
    },
    events: [],
    dispatchDays: [
      {
        dateIso: "2026-07-15",
        dayLabel: "Wed, Jul 15",
        yardmatchJobCount: 0,
        externalBlockCount: 0,
        totalCrewRequired: 0,
        totalCrewAssigned: 0,
        crewGap: 0,
        bookedMinutes: 0,
        blockedMinutes: 0,
        estimatedDriveMiles: 0,
        longestDriveLegMiles: 0,
        largestIdleGapMinutes: 0,
        outlierStopCount: 0,
        routeStatus: "comfortable",
        recommendations: [],
        windowSummaries: [
          {
            windowKey: "morning",
            label: "Morning",
            yardmatchJobCount: 0,
            externalBlockCount: 0,
            totalCrewRequired: 0,
            totalCrewAssigned: 0,
            crewGap: 0,
            bookedMinutes: 0,
            blockedMinutes: 0
          }
        ]
      }
    ]
  };

  const localized = await localizeProviderCalendarOverview(overview, {
    "x-yardmatch-locale": "es"
  });

  assert.equal(localized.dispatchDays[0]?.windowSummaries[0]?.windowKey, "morning");
  assert.equal(localized.dispatchDays[0]?.windowSummaries[0]?.label, "Manana");
});
