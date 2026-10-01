"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addLocalePrefix } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { serviceCategoryLabelKeys } from "@yardmatch/i18n/service-labels";
import { journeyApi, openingLabel, readBookingDraft, saveBookingDraft, type BookingDraft } from "../lib/bookingJourney";
import { useStoredWebSession } from "../lib/session";
import { getLaunchAttributionContext } from "../lib/launchAttribution";
import { BookingScheduleModal } from "./BookingScheduleModal";

export function BookingReviewPage() {
  const i18n = useI18n(); const router = useRouter(); const params = useSearchParams(); const { session, sessionReady } = useStoredWebSession();
  const id = params.get("draft") ?? "";
  const [draft, setDraft] = useState<BookingDraft>(); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [ready, setReady] = useState(false);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [editing, setEditing] = useState(false); const submitting = useRef(false); const version = useRef(0);

  async function refresh(input: BookingDraft, preserveError = false) {
    const revision = ++version.current; setLoading(true); if (!preserveError) setError(""); setReady(false); setNotice("");
    try {
      const api = journeyApi();
      if (input.confirmationAttempted && session?.role === "customer") {
        const saved = await api.getCustomerBookingForRequest(input.id);
        if (revision !== version.current) return;
        if (saved) {
          saveBookingDraft({ ...input, bookingId: saved.id });
          router.replace(addLocalePrefix(`/customer/booking/confirmation?bookingId=${encodeURIComponent(saved.id)}`, i18n.locale));
          return;
        }
      }
      const quotes = await Promise.all(input.categories.map(category => api.createInstantQuote({ providerId: input.provider.id, address: input.address, category, followUpAnswers: input.answers[category] })));
      const duration = quotes.reduce((sum, quote) => sum + quote.estimatedDurationMinutes, 0);
      const slots = await api.getProviderAvailability({ providerId: input.provider.id, address: quotes[0].address, categories: input.categories, estimatedDurationMinutes: duration });
      if (revision !== version.current) return;
      const opening = slots.find(slot => slot.startIso === input.slot.startIso);
      if (!opening || quotes.some(quote => !quote.quoteReadyForCheckout)) throw new Error(i18n.t("booking_journey.slot_changed"));
      const next = { ...input, quotes, address: quotes[0].address, ownerId: session?.role === "customer" ? session.userId : input.ownerId,
        slot: { ...opening, endIso: new Date(Date.parse(opening.startIso) + duration * 60000).toISOString() } };
      if (quotes.reduce((sum, quote) => sum + quote.estimatedPriceCents, 0) !== input.quotes.reduce((sum, quote) => sum + quote.estimatedPriceCents, 0)) setNotice(i18n.t("booking_journey.review.changed"));
      saveBookingDraft(next); setDraft(next); setReady(true);
    } catch (err) { if (revision === version.current) setError(err instanceof Error ? err.message : i18n.t("booking_journey.error")); }
    finally { if (revision === version.current) setLoading(false); }
  }
  useEffect(() => {
    if (!sessionReady || editing) return;
    const stored = readBookingDraft(id); setDraft(stored);
    if (stored?.bookingId) { router.replace(addLocalePrefix(`/customer/booking/confirmation?bookingId=${encodeURIComponent(stored.bookingId)}`, i18n.locale)); return; }
    if (stored) void refresh(stored); else setLoading(false);
    const invalidatedRevision = version.current + 1;
    return () => { version.current = invalidatedRevision; };
    // A changed customer session must obtain new quotes before confirmation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sessionReady, session?.userId, editing]);

  async function confirm() {
    if (!draft || !ready || session?.role !== "customer" || submitting.current) return;
    submitting.current = true; setBusy(true); setError("");
    const attempted = { ...draft, confirmationAttempted: true };
    saveBookingDraft(attempted); setDraft(attempted);
    try {
      const booking = await journeyApi().createBooking({
        requestId: draft.id, providerId: draft.provider.id, serviceAddress: draft.address, category: draft.categories[0],
        services: draft.quotes.map(quote => ({ category: quote.category, quoteToken: quote.quoteToken! })),
        scheduledStartIso: draft.slot.startIso, scheduledEndIso: draft.slot.endIso,
        totalCents: draft.quotes.reduce((sum, quote) => sum + quote.estimatedPriceCents, 0), notes: "",
        recommendationSessionId: draft.recommendationSessionId, recommendedProviderId: draft.recommendedProviderId, selectedProviderRank: draft.rank,
        viewedAlternativeProviders: draft.directory || draft.rank > 1, requestSource: "public-web-booking", recommendationSource: "public-web-listings", attribution: getLaunchAttributionContext()
      });
      saveBookingDraft({ ...draft, bookingId: booking.id });
      router.replace(addLocalePrefix(`/customer/booking/confirmation?bookingId=${encodeURIComponent(booking.id)}`, i18n.locale));
    } catch (err) {
      setError(err instanceof Error ? err.message : i18n.t("booking_journey.error"));
      // The server may have committed before the connection dropped. Reconcile the
      // stable request identifier before allowing a fresh quote or another attempt.
      await refresh(attempted, true);
    }
    finally { submitting.current = false; setBusy(false); }
  }
  if (!sessionReady || (loading && !draft)) return <main className="container journey-page"><p role="status">{i18n.t("booking_journey.book.checking")}</p></main>;
  if (!draft) return <main className="container journey-page"><h1>{i18n.t("booking_journey.review.title")}</h1><p>{i18n.t("booking_journey.review.expired")}</p><Link className="button" href={addLocalePrefix("/", i18n.locale)}>{i18n.t("booking_journey.new_search")}</Link></main>;
  const returnTo = addLocalePrefix(`/customer/booking/review?draft=${draft.id}`, i18n.locale);
  const signupParams = new URLSearchParams({ returnTo, draft: draft.id });
  return <main className="container journey-page">
    <Link className="journey-back" href={draft.returnTo}>{i18n.t("booking_journey.back")}</Link>
    <header><span className="eyebrow">{i18n.t("booking_journey.schedule.with", { provider: draft.provider.companyName })}</span><h1>{i18n.t("booking_journey.review.title")}</h1><p>{i18n.t("booking_journey.review.body")}</p></header>
    <div className="journey-review-layout"><section className="card journey-review-card"><h2>{draft.provider.companyName}</h2>
      <dl className="journey-summary"><div><dt>{i18n.t("booking_journey.day")}</dt><dd>{openingLabel(i18n, draft.slot.startIso)}</dd></div><div><dt>{i18n.t("booking_journey.address.title")}</dt><dd>{draft.address.line1}{draft.address.line2 ? `, ${draft.address.line2}` : ""}<br />{draft.address.city}, {draft.address.state} {draft.address.postalCode}</dd></div></dl>
      <h3>{i18n.t("booking_journey.services")}</h3><ul className="journey-price-lines">{draft.quotes.map(quote => <li key={quote.category}><span>{i18n.t(serviceCategoryLabelKeys[quote.category])}</span><strong>{i18n.formatCurrency(quote.estimatedPriceCents, "USD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></li>)}</ul>
      <p className="journey-muted">{i18n.t("booking_journey.review.duration", { minutes: draft.quotes.reduce((sum, quote) => sum + quote.estimatedDurationMinutes, 0) })}</p>
      <button className="button-secondary" type="button" disabled={busy} onClick={() => setEditing(true)}>{i18n.t("booking_journey.review.edit")}</button>
    </section><section className="card journey-review-total"><div className="journey-total"><span>{i18n.t("booking_journey.review.total")}</span><strong>{i18n.formatCurrency(draft.quotes.reduce((sum, quote) => sum + quote.estimatedPriceCents, 0), "USD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div><p>{i18n.t("booking_journey.book.no_charge")}</p>
      {notice ? <p role="status">{notice}</p> : null}{error ? <div role="alert" className="journey-error"><p>{error}</p><button className="button-secondary" type="button" disabled={busy || loading} onClick={() => void refresh(draft)}>{i18n.t("booking_journey.review.refresh")}</button></div> : null}
      {session?.role === "customer" ? <button className="button" type="button" disabled={busy || loading || !ready} onClick={() => void confirm()}>{i18n.t(busy ? "booking_journey.review.confirming" : loading ? "booking_journey.book.checking" : "booking_journey.review.confirm")}</button>
        : <div className="journey-auth"><h3>{i18n.t("booking_journey.review.auth")}</h3><p>{i18n.t(session ? "booking_journey.review.wrong_role" : "booking_journey.review.auth_body")}</p><Link className="button" href={addLocalePrefix(`/login/customer?returnTo=${encodeURIComponent(returnTo)}`, i18n.locale)}>{i18n.t("booking_journey.review.login")}</Link><Link className="button-secondary" href={addLocalePrefix(`/auth/customer?${signupParams}`, i18n.locale)}>{i18n.t("booking_journey.review.signup")}</Link></div>}
    </section></div>
    {editing ? <BookingScheduleModal provider={draft.provider} address={draft.address} category={draft.categories[0]} opening={draft.slot} rank={draft.rank} directory={draft.directory} initialDraft={draft} recommendationSessionId={draft.recommendationSessionId} recommendedProviderId={draft.recommendedProviderId} onClose={() => setEditing(false)} /> : null}
  </main>;
}
