"use client";
import { useI18n } from "@yardmatch/i18n/react";
import { useLaunchFeatureFlags } from "./LaunchFeatureFlagsProvider";

/**
 * Two short lines at the point of booking: cancelling is free until the provider is on the way (the API's rule), and
 * how the customer pays. Reassurance, not a policy wall.
 */
export function BookingTerms({ providerName }: { providerName: string }) {
  const i18n = useI18n();
  const { payments } = useLaunchFeatureFlags();
  return <div className="booking-terms">
    <p>{i18n.t("booking_terms.cancel", { provider: providerName })}</p>
    <p>{payments ? i18n.t("booking_journey.book.no_charge") : i18n.t("booking_terms.pay_directly", { provider: providerName })}</p>
  </div>;
}
