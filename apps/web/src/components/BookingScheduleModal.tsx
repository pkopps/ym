"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Address, AvailabilitySlot, InstantQuoteResponse, MarketplaceProviderProfile, QuoteFollowUpAnswer, ServiceCategory } from "@yardmatch/contracts";
import { isPlaceSuggestionSafeToAutoSelect } from "@yardmatch/contracts";
import { addLocalePrefix } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { serviceCategoryLabelKeys } from "@yardmatch/i18n/service-labels";
import { arrivalWindow, arrivalWindows, journeyApi, saveBookingDraft, serviceDay, serviceTimeZone, type ArrivalWindow, type BookingDraft } from "../lib/bookingJourney";
import { loadStoredSession } from "../lib/api";
import { JourneyDialog } from "./JourneyDialog";

export function BookingScheduleModal({ provider, address: initialAddress, category, opening, rank, directory, recommendationSessionId, recommendedProviderId, initialDraft, onClose }: {
  provider: MarketplaceProviderProfile; address: Address; category: ServiceCategory; opening?: AvailabilitySlot;
  rank: number; directory: boolean; recommendationSessionId?: string; recommendedProviderId?: string; initialDraft?: BookingDraft; onClose: () => void;
}) {
  const i18n = useI18n();
  const router = useRouter();
  const originalSlot = initialDraft?.slot ?? opening;
  const [categories, setCategories] = useState<ServiceCategory[]>(initialDraft?.categories ?? [category]);
  const [query, setQuery] = useState("");
  const [showServices, setShowServices] = useState(false);
  const [address, setAddress] = useState<Address>(initialDraft?.address ?? { ...initialAddress, line1: /\d/.test(initialAddress.line1) && initialAddress.line1 !== initialAddress.city ? initialAddress.line1 : "" });
  const [day, setDay] = useState(originalSlot ? serviceDay(originalSlot.startIso) : "");
  const [window, setWindow] = useState<ArrivalWindow>(originalSlot ? arrivalWindow(originalSlot.startIso) : "morning");
  const [slots, setSlots] = useState<AvailabilitySlot[]>(originalSlot ? [originalSlot] : []);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [quotes, setQuotes] = useState<InstantQuoteResponse[]>([]);
  const [answers, setAnswers] = useState<Record<string, QuoteFollowUpAnswer[]>>(initialDraft?.answers ?? {});
  const dirtyAddress = useRef(Boolean(initialDraft));
  const submitting = useRef(false);
  const categoriesKey = categories.join(",");

  useEffect(() => {
    let active = true;
    if (!initialDraft && loadStoredSession()?.role === "customer") {
      journeyApi().getCustomerProperties().then(properties => {
        const property = properties.find(item => item.isDefault) ?? properties[0];
        if (active && property && !dirtyAddress.current) setAddress(property.address);
      }).catch(() => undefined);
    }
    return () => { active = false; };
  }, [initialDraft]);

  useEffect(() => {
    let active = true;
    if (!categoriesKey) { setSlots([]); setLoading(false); return; }
    setLoading(true);
    journeyApi().getProviderAvailability({ providerId: provider.id, address: initialAddress, categories: categoriesKey.split(",") as ServiceCategory[] })
      .then(result => {
        if (!active) return;
        setSlots(result);
        if (!originalSlot && result[0]) { setDay(serviceDay(result[0].startIso)); setWindow(arrivalWindow(result[0].startIso)); }
      }).catch(err => { if (active) { setSlots([]); setError(err instanceof Error ? err.message : i18n.t("booking_journey.error")); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [categoriesKey, provider.id, initialAddress, originalSlot, i18n]);

  const dates = [...new Set([...(day ? [day] : []), ...slots.map(slot => serviceDay(slot.startIso))])].sort();
  const matchingSlot = slots.find(slot => serviceDay(slot.startIso) === day && arrivalWindow(slot.startIso) === window);
  const services = provider.categories.filter(value => !categories.includes(value) && i18n.t(serviceCategoryLabelKeys[value]).toLowerCase().includes(query.toLowerCase()));
  function updateAddress(key: keyof Address, value: string) {
    dirtyAddress.current = true;
    setAddress(current => ({ ...current, [key]: value }));
    setQuotes([]); setAnswers({}); setError("");
  }
  function updateServices(next: ServiceCategory[]) { setCategories(next); setQuotes([]); setError(""); }
  function answer(category: string, questionId: string, value: string | number) {
    setAnswers(current => ({ ...current, [category]: [...(current[category] ?? []).filter(item => item.questionId !== questionId), { questionId, value }] }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || !categories.length) return;
    submitting.current = true; setBusy(true); setError("");
    try {
      const api = journeyApi();
      // Re-resolve the entered area so editing a city or ZIP cannot retain stale coordinates.
      const places = await api.searchPlaces(`${address.city}, ${address.state} ${address.postalCode}`);
      const place = places.suggestions.find(item => isPlaceSuggestionSafeToAutoSelect(item) &&
        item.address.state.toUpperCase() === address.state.trim().toUpperCase() &&
        (item.address.postalCode === address.postalCode.trim() || item.address.city.toLowerCase() === address.city.trim().toLowerCase()));
      if (!place) throw new Error(i18n.t("booking_journey.address.unresolved"));
      const nextAddress = { ...address, point: place.address.point, geocodePrecision: place.address.geocodePrecision, geocodeProvider: place.address.geocodeProvider };
      const nextQuotes = await Promise.all(categories.map(category => api.createInstantQuote({ address: nextAddress, category, followUpAnswers: answers[category] })));
      setQuotes(nextQuotes);
      if (nextQuotes.some(quote => !quote.quoteReadyForCheckout)) return;
      const duration = nextQuotes.reduce((sum, quote) => sum + quote.estimatedDurationMinutes, 0);
      const verifiedAddress = nextQuotes[0].address;
      const openings = await api.getProviderAvailability({ providerId: provider.id, address: verifiedAddress, categories, estimatedDurationMinutes: duration });
      setSlots(openings);
      const selectedSlot = openings.find(slot => serviceDay(slot.startIso) === day && arrivalWindow(slot.startIso) === window);
      if (!selectedSlot) throw new Error(i18n.t("booking_journey.slot_changed"));
      const draft: BookingDraft = {
        id: initialDraft?.id ?? crypto.randomUUID(), createdAt: Date.now(), ownerId: loadStoredSession()?.role === "customer" ? loadStoredSession()?.userId : undefined,
        provider, categories, quotes: nextQuotes, answers, address: verifiedAddress,
        slot: { ...selectedSlot, endIso: new Date(Date.parse(selectedSlot.startIso) + duration * 60000).toISOString() },
        recommendationSessionId, recommendedProviderId, rank, directory,
        returnTo: initialDraft?.returnTo ?? `${globalThis.location.pathname}${globalThis.location.search}`
      };
      saveBookingDraft(draft);
      router.push(addLocalePrefix(`/customer/booking/review?draft=${draft.id}`, i18n.locale));
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : i18n.t("booking_journey.error")); }
    finally { submitting.current = false; setBusy(false); }
  }

  return <JourneyDialog title={i18n.t("booking_journey.schedule.title")} onClose={() => { if (!busy) onClose(); }}>
    <div className="journey-dialog__header"><div><h2>{i18n.t("booking_journey.schedule.title")}</h2><p>{i18n.t("booking_journey.schedule.with", { provider: provider.companyName })}</p></div>
      <button className="journey-close" type="button" disabled={busy} onClick={onClose} aria-label={i18n.t("booking_journey.close")}>×</button></div>
    <form onSubmit={submit} className="journey-form">
      <fieldset disabled={busy} className="journey-fieldset">
        <legend>{i18n.t("booking_journey.services")}</legend>
        <div className="journey-service-picker">
          <div className="journey-service-chips">{categories.map(value => <span className="journey-service-chip" key={value}>{i18n.t(serviceCategoryLabelKeys[value])}<button type="button" onClick={() => updateServices(categories.filter(item => item !== value))} aria-label={i18n.t("booking_journey.services.remove", { service: i18n.t(serviceCategoryLabelKeys[value]) })}>×</button></span>)}</div>
          <input type="search" value={query} placeholder={i18n.t("booking_journey.services.add")} aria-label={i18n.t("booking_journey.services.search")} onFocus={() => setShowServices(true)} onChange={event => { setQuery(event.target.value); setShowServices(true); }} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); setShowServices(false); } if (event.key === "Enter") { event.preventDefault(); if (services[0]) { updateServices([...categories, services[0]]); setQuery(""); setShowServices(false); } } }} />
          {showServices && services.length > 0 ? <div className="journey-service-options">{services.map(value => <button type="button" key={value} onClick={() => { updateServices([...categories, value]); setQuery(""); setShowServices(false); }}>+ {i18n.t(serviceCategoryLabelKeys[value])}</button>)}</div> : null}
        </div><small>{i18n.t("booking_journey.services.hint")}</small>
      </fieldset>
      <div className="journey-form__row">
        <label>{i18n.t("booking_journey.day")}<select required disabled={busy || loading} value={day} onChange={event => { const next = event.target.value; setDay(next); const first = slots.find(slot => serviceDay(slot.startIso) === next); if (first) setWindow(arrivalWindow(first.startIso)); setError(""); }}>
          {!day && <option value="">{i18n.t("booking_journey.choose")}</option>}{dates.map(value => <option key={value} value={value}>{i18n.formatDate(`${value}T16:00:00Z`, { timeZone: serviceTimeZone, weekday: "short", month: "short", day: "numeric" })}</option>)}
        </select></label>
        <label>{i18n.t("booking_journey.window")}<select disabled={busy || loading} value={window} onChange={event => { setWindow(event.target.value as ArrivalWindow); setError(""); }}>{arrivalWindows.map(value => <option key={value} value={value} disabled={!slots.some(slot => serviceDay(slot.startIso) === day && arrivalWindow(slot.startIso) === value)}>{i18n.t(`customer.window.${value}`)}</option>)}</select></label>
      </div>
      {loading ? <p role="status">{i18n.t("booking_journey.openings.loading")}</p> : !matchingSlot ? <p role="status">{i18n.t("booking_journey.openings.none")}</p> : null}
      <fieldset disabled={busy} className="journey-fieldset"><legend>{i18n.t("booking_journey.address.title")}</legend>
        <label>{i18n.t("booking_journey.address.street")}<input autoComplete="street-address" value={address.line1} required onChange={event => updateAddress("line1", event.target.value)} /></label>
        <label>{i18n.t("booking_journey.address.unit")}<input autoComplete="address-line2" value={address.line2 ?? ""} onChange={event => updateAddress("line2", event.target.value)} /></label>
        <div className="journey-form__address-row"><label>{i18n.t("booking_journey.address.city")}<input autoComplete="address-level2" value={address.city} required onChange={event => updateAddress("city", event.target.value)} /></label>
          <label>{i18n.t("booking_journey.address.state")}<input autoComplete="address-level1" maxLength={2} minLength={2} value={address.state} required onChange={event => updateAddress("state", event.target.value.toUpperCase())} /></label>
          <label>{i18n.t("booking_journey.address.zip")}<input autoComplete="postal-code" pattern="[0-9]{5}(-[0-9]{4})?" value={address.postalCode} required onChange={event => updateAddress("postalCode", event.target.value)} /></label></div>
      </fieldset>
      {quotes.some(quote => quote.followUpQuestions.length > 0) ? <fieldset className="journey-fieldset" disabled={busy}><legend>{i18n.t("booking_journey.property_questions")}</legend><p>{i18n.t("booking_journey.property_questions.body")}</p>
        {quotes.map(quote => quote.followUpQuestions.map(question => <label key={`${quote.category}-${question.id}`}>{i18n.t(serviceCategoryLabelKeys[quote.category])} · {question.prompt}
          {question.inputType === "single-select" ? <select required value={answers[quote.category]?.find(item => item.questionId === question.id)?.value ?? ""} onChange={event => answer(quote.category, question.id, event.target.value)}><option value="">{i18n.t("booking_journey.choose")}</option>{question.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            : <input type="number" required min={question.min} max={question.max} value={answers[quote.category]?.find(item => item.questionId === question.id)?.value ?? ""} onChange={event => answer(quote.category, question.id, event.target.value === "" ? "" : Number(event.target.value))} />}
          <small>{question.helperText}</small></label>))}</fieldset> : null}
      {error ? <p className="journey-error" role="alert">{error}</p> : null}
      <div className="journey-dialog__footer"><button className="button" disabled={busy || loading || !categories.length || !matchingSlot} type="submit">{i18n.t(busy ? "booking_journey.book.checking" : "booking_journey.book")}</button><small>{i18n.t("booking_journey.book.review_hint")}</small></div>
    </form>
  </JourneyDialog>;
}
