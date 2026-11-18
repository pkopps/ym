// Regression coverage for the explorer re-run of November 17, 2026 (reports/explorer/summary-2026-11-17.md).
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { isPlaceSuggestionSafeToAutoSelect } from "@yardmatch/contracts";
import { hashPassword } from "../src/auth";
import { HttpError } from "../src/http";
import { InMemoryMarketplaceRepository } from "../src/repositories/InMemoryMarketplaceRepository";
import { MarketplacePlatformService } from "../src/services/MarketplacePlatformService";
import { createWorkflowBooking } from "./helpers/workflowBooking";

const future = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

async function fixture() {
  const repository = new InMemoryMarketplaceRepository();
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());
  const provider = (await repository.listProviders())[0]!;
  const customer = await platform.registerUser({ role: "customer", fullName: "Rerun Customer", email: `${randomUUID()}@example.invalid`, address: provider.address, propertyLabel: "Home" }, await hashPassword("Original123!"));
  return { repository, platform, provider, customer };
}

test("N1: a weak new password at reset is a 400 that says the rule, not a server error", async () => {
  const { platform, customer } = await fixture();
  const { resetCodePreview } = await platform.requestPasswordReset({ email: customer.email });
  for (const newPassword of ["abc", "alllowercase1"]) {
    await assert.rejects(
      platform.confirmPasswordReset({ email: customer.email, resetCode: resetCodePreview!, newPassword }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 400 && /Password must/.test(error.message)
    );
  }
  // The code still works once the password meets the rule.
  const user = await platform.confirmPasswordReset({ email: customer.email, resetCode: resetCodePreview!, newPassword: "Changed123!" });
  assert.equal(user.email, customer.email);
});

test("N3: a no-show can't be reported before the arrival window starts; other issues still can", async () => {
  const { repository, platform, provider, customer } = await fixture();
  const booking = await createWorkflowBooking(platform, repository, customer.id, {
    providerId: provider.id, serviceAddress: customer.properties[0]!.address, servicePropertyId: customer.properties[0]!.id, category: "lawn-mowing",
    scheduledStartIso: future(48), scheduledEndIso: future(49), notes: "", totalCents: 6_000
  });
  await platform.confirmBooking(provider.id, { bookingId: booking.id });
  await assert.rejects(
    platform.markBookingException(provider.id, { bookingId: booking.id, exceptionType: "customer-no-show", notes: "Nobody home." }),
    (error: unknown) => error instanceof HttpError && error.statusCode === 409 && /once the arrival window starts/.test(error.message)
  );
  assert.equal((await repository.findBookingById(booking.id))!.activeExceptionType, undefined);
  const notReady = await platform.markBookingException(provider.id, { bookingId: booking.id, exceptionType: "customer-not-ready", notes: "Gate is locked." });
  assert.equal(notReady.activeExceptionType, "customer-not-ready");
});

test("N4: a typed street address with its town or ZIP finds that town, ready to search without picking", async () => {
  const { platform } = await fixture();
  for (const [query, label] of [
    ["12 Bay Ave, Barnegat, NJ 08005", "Barnegat, NJ"],
    ["12 Bay Ave, Barnegat", "Barnegat, NJ"],
    ["1200 Ocean Ave, Toms River, NJ", "Toms River, NJ"],
    ["9 Elm St, Manahawkin NJ 08050", "Manahawkin, NJ"],
    ["08005", "Barnegat, NJ"]
  ] as const) {
    const top = (await platform.searchPlaces(query)).suggestions[0];
    assert.equal(top?.label, label, query);
    assert.ok(isPlaceSuggestionSafeToAutoSelect(top), `${query} should be safe to search without picking`);
  }
  // A house number is never read as a ZIP, and an unknown town is not guessed.
  const unknown = (await platform.searchPlaces("12 Main St, Springfield, NJ 07081")).suggestions;
  assert.equal(unknown.some(isPlaceSuggestionSafeToAutoSelect), false);
  const houseNumber = (await platform.searchPlaces("08005 Ocean Ave, Toms River")).suggestions[0];
  assert.equal(houseNumber?.label, "Toms River, NJ");
});
