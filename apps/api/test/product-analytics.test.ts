import assert from "node:assert/strict";
import { test } from "node:test";
import { AnalyticsRateLimit, ProductAnalytics, validateClientEvent } from "../src/observability/ProductAnalytics";
import type { RequestContext } from "../src/http";
const event = () => ({id: crypto.randomUUID(), name: "page_viewed", occurredAt: new Date().toISOString(),
  actorId: "spoofed-user", properties: {anonymousId: crypto.randomUUID(), sessionId: crypto.randomUUID(), consent: true,
    role: "ops", path: "/customer/listings", email: "person@example.com", secret: "password", destination: "/auth?code=secret"}});

test("client telemetry cannot impersonate a payment or authenticated actor", () => {
  assert.throws(() => validateClientEvent({...event(), name: "payment_captured"}), /Unsupported/);
  const anonymous = validateClientEvent(event());
  assert.equal(anonymous.actorId, undefined);
  assert.equal(anonymous.properties.role, "anonymous");
  const known = validateClientEvent(event(), {userId: "real-user", role: "customer"});
  assert.equal(known.actorId, "real-user");
  assert.equal(known.properties.email, undefined);
  assert.equal(known.properties.secret, undefined);
  assert.equal(known.properties.destination, undefined);
});
test("analytics requires permission and bounded valid timestamps and properties", () => {
  assert.throws(() => validateClientEvent({...event(), properties: {consent: false}}), /permission/);
  assert.throws(() => validateClientEvent({...event(), occurredAt: "invalid"}), /timestamp/);
  assert.throws(() => validateClientEvent({...event(), occurredAt: "2099-01-01"}), /timestamp/);
  assert.throws(() => validateClientEvent({...event(), properties: []}), /properties/);
});
test("duplicate delivery does not inflate event counts", async () => {
  const analytics = new ProductAnalytics();
  const input = validateClientEvent(event());
  analytics.record(input); analytics.record(input);
  const report = await analytics.report();
  assert.equal(report.counts.page_viewed.events, 1);
  assert.equal(report.durable, false);
  assert.equal(report.lowSample, true);
});
test("analytics collection rate limit bounds an untrusted sender", () => {
  const limiter = new AnalyticsRateLimit();
  const context = {clientAddress: "test-sender"} as RequestContext;
  for (let index = 0; index < 180; index++) limiter.check(context);
  assert.throws(() => limiter.check(context), /limit/);
});

import { buildAnalyticsFunnel } from "../src/observability/analyticsFunnel";
test("ordered funnel joins anonymous visitors and counts only trusted outcomes", () => {
  const names = ["page_viewed", "journey_identified", "instant_quote_generated", "provider_search_performed", "recommendation_presented", "booking_requested", "booking_confirmed", "payment_captured", "booking_completed"];
  const events = names.map((name, index) => ({id: crypto.randomUUID(), name,
    occurredAt: new Date(Date.now() + index).toISOString(), actorId: index ? "customer123" : undefined,
    properties: {anonymousId: "anonymous123", origin: index < 2 ? "client" : "server"}}));
  assert.equal(buildAnalyticsFunnel(events).steps.at(-1)?.people, 1);
  events.at(-1)!.properties.origin = "client";
  assert.equal(buildAnalyticsFunnel(events).steps.at(-1)?.people, 0);
});

test("mobile visits and provider/payment actors join the customer booking funnel", () => {
  const names = ["screen_viewed", "journey_identified", "instant_quote_generated", "provider_search_performed", "recommendation_presented", "booking_requested", "booking_confirmed", "payment_captured", "booking_completed"];
  const events = names.map((name,index) => ({id:crypto.randomUUID(),name,occurredAt:new Date(Date.now()+index).toISOString(),
    actorId:index === 0 ? undefined : index === 6 ? "provider123" : index === 7 ? "booking123" : "customer123",
    properties:{anonymousId:"visitor123",origin:index<2?"client":"server",...(index===5?{bookingId:"booking123"}:{}),...(index===6?{customerId:"customer123"}:{})}}));
  assert.equal(buildAnalyticsFunnel(events).steps.at(-1)?.people,1);
});

test("quotes with optional follow-up questions still progress through the measured journey", () => {
  const names=["page_viewed","instant_quote_needs_follow_up","provider_search_performed","recommendation_presented","booking_requested"];
  const result=buildAnalyticsFunnel(names.map((name,index)=>({id:crypto.randomUUID(),name,actorId:"customer123",
    occurredAt:new Date(Date.now()+index).toISOString(),properties:{origin:index?"server":"client", ...(index===1?{category:"lawn-mowing", area:"Barnegat"}:{})}})));
  assert.equal(result.steps.find(step=>step.name==="booking_requested")?.people,1);
  assert.equal(result.segments["category:lawn-mowing"].requested,1);
  assert.equal(result.segments["area:Barnegat"].visitors,1);
});
