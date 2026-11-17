"use client";
import { useEffect, useState } from "react";
import type { ProviderBillingStatusResponse } from "@yardmatch/contracts";
import { useI18n } from "@yardmatch/i18n/react";
import { createAuthenticatedWebApiClient } from "../lib/api";

const RETURN_PATH = "/provider/management#provider-billing";
// One completion per Stripe return, even when React runs the effect twice.
const completions = new Map<string, Promise<ProviderBillingStatusResponse>>();

function readStripeReturn(): { outcome?: string; setupSessionId?: string } {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return { outcome: params.get("billing") ?? undefined, setupSessionId: params.get("setup_session_id") ?? undefined };
}

/** Lets a provider save or replace the card YardMatch bills finder fees to. */
export function ProviderBillingPanel() {
  const i18n = useI18n();
  const [status, setStatus] = useState<ProviderBillingStatusResponse>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [{ outcome, setupSessionId }] = useState(readStripeReturn);

  useEffect(() => {
    let active = true;
    const api = createAuthenticatedWebApiClient();
    if (outcome) {
      const params = new URLSearchParams(window.location.search);
      params.delete("billing");
      params.delete("setup_session_id");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    }
    let request: Promise<ProviderBillingStatusResponse>;
    if (outcome === "card-saved" && setupSessionId) {
      request = completions.get(setupSessionId) ?? api.completeProviderCardSetup({ setupSessionId });
      completions.set(setupSessionId, request);
    } else {
      request = api.getProviderBilling();
    }
    request
      .then(next => {
        if (!active) return;
        setStatus(next);
        if (outcome === "card-saved" && setupSessionId) setMessage(i18n.t("provider_billing.saved"));
        if (outcome === "card-cancelled") setMessage(i18n.t("provider_billing.cancelled"));
      })
      .catch(() => { if (active) setError(i18n.t("provider_billing.error")); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [i18n, outcome, setupSessionId]);

  async function startSetup() {
    setBusy(true); setError(""); setMessage("");
    try {
      const { url } = await createAuthenticatedWebApiClient().startProviderCardSetup({ returnPath: RETURN_PATH });
      window.location.assign(url);
    } catch {
      setError(i18n.t("provider_billing.error"));
      setBusy(false);
    }
  }

  const amount = (cents: number) => i18n.formatCurrency(cents, "USD", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const size = (sqFt: number) => new Intl.NumberFormat(i18n.locale).format(sqFt);

  return <section className="stack-md" aria-label={i18n.t("provider_billing.title")}>
    <p>{i18n.t("provider_billing.description")}</p>
    {status ? <ul className="timeline">
      {status.finderFees.map((row, index) => {
        const previous = status.finderFees[index - 1]?.maxLawnSqFt;
        const label = row.maxLawnSqFt !== undefined
          ? i18n.t("provider_billing.tier_up_to", { size: size(row.maxLawnSqFt) })
          : i18n.t("provider_billing.tier_over", { size: size(previous ?? 0) });
        return <li key={row.tier}><strong>{amount(row.feeCents)}</strong><span>{label}</span></li>;
      })}
    </ul> : null}
    {status?.firstCustomerFree ? <p>{i18n.t("provider_billing.first_free")}</p> : null}
    {busy && !status ? <p role="status">{i18n.t("provider_billing.loading")}</p> : null}
    {status ? <p><strong>
      {status.hasCardOnFile && status.card?.last4
        ? i18n.t("provider_billing.card_on_file", {
          brand: (status.card.brand ?? "card").replace(/^\w/, letter => letter.toUpperCase()),
          last4: status.card.last4,
          expiry: status.card.expMonth && status.card.expYear ? `${String(status.card.expMonth).padStart(2, "0")}/${status.card.expYear}` : "—"
        })
        : i18n.t("provider_billing.no_card")}
    </strong></p> : null}
    {status && status.chargesNeedingAttention > 0 ? <p role="alert">{i18n.t("provider_billing.attention", { count: status.chargesNeedingAttention })}</p> : null}
    {status && !status.billingConfigured ? <p>{i18n.t("provider_billing.unavailable")}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {message ? <p role="status">{message}</p> : null}
    {status?.billingConfigured ? <div>
      <button type="button" className="button" disabled={busy} onClick={() => void startSetup()}>
        {status.hasCardOnFile ? i18n.t("provider_billing.replace_card") : i18n.t("provider_billing.add_card")}
      </button>
    </div> : null}
    {status?.billingConfigured ? <p>{i18n.t("provider_billing.secure_note")}</p> : null}
  </section>;
}
