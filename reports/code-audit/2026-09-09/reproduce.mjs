// Audit evidence: assertions describe CURRENT BUGGY behavior, not desired behavior.
// Run from repository root: node --import tsx --test reports/code-audit/2026-09-09/reproduce.mjs
// Uses disposable in-memory fixtures and stubbed vendors; never connects to a database.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DataEngineeringLogger } from '../../../packages/analytics/src/index.ts';
import { InMemoryMarketplaceRepository } from '../../../apps/api/src/repositories/InMemoryMarketplaceRepository.ts';
import { MarketplacePlatformService } from '../../../apps/api/src/services/MarketplacePlatformService.ts';
import { AuthController } from '../../../apps/api/src/controllers/AuthController.ts';
import { MarketplaceController } from '../../../apps/api/src/controllers/MarketplaceController.ts';
import { hashPassword, signSessionToken, verifySessionToken } from '../../../apps/api/src/auth.ts';

for (const key of ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'GOOGLE_MAPS_API_KEY', 'GOOGLE_ADDRESS_VALIDATION_API_KEY', 'RESEND_API_KEY', 'TWILIO_AUTH_TOKEN', 'BLOB_READ_WRITE_TOKEN']) delete process.env[key];
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-audit-fixture-secret-at-least-thirty-two-characters';
process.env.TZ = 'UTC';
globalThis.fetch = async url => {
  if (String(url).startsWith('data:text/calendar,')) return new Response(decodeURIComponent(String(url).split(',').slice(1).join(',')));
  throw new Error('Audit blocks external network requests');
};

const future = hours => new Date(Date.now() + hours * 3600000).toISOString();
function response() {
  const headers = new Map();
  return { status: 200, data: undefined, setHeader(k,v) { headers.set(k,v); }, getHeader(k) { return headers.get(k); }, writeHead(s,h) { this.status=s; for (const [k,v] of Object.entries(h ?? {})) headers.set(k,v); }, end(s) { this.data=s; } };
}
async function fixture() {
  const repository = new InMemoryMarketplaceRepository();
  let sessions = 0;
  const gateway = {
    isConfigured: () => true,
    createCheckoutSession: async () => { const id = `cs_audit_${++sessions}`; return { checkoutSessionId: id, checkoutUrl: `https://checkout.example/${id}`, paymentIntentId: `pi_${id}` }; },
    verifyCheckoutSession: async id => ({ checkoutSessionId: id, paymentIntentId: `pi_${id}`, paid: true }),
    retrieveChargeFinancials: async () => ({ chargeId: 'ch_audit', actualProcessorFeeCents: 50 }),
    parseWebhookEvent: async raw => JSON.parse(raw),
    createRefund: async () => ({ refundId: 're_audit', status: 'succeeded' })
  };
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger(), gateway);
  const provider = (await repository.listProviders())[0];
  await repository.updateProvider(provider.id, { minimumBookingLeadHours: 0 });
  const customer = await platform.registerUser({ fullName: 'Audit Customer', email: 'audit-customer@example.com', phone: '555-0200', role: 'customer', address: provider.address }, hashPassword('Password123!'));
  const payload = { providerId: provider.id, serviceAddress: provider.address, category: 'lawn-mowing', scheduledStartIso: future(72), scheduledEndIso: future(74), totalCents: 6400, notes: 'Audit service request' };
  return { repository, platform, provider, customer, payload, gateway };
}
function authContext(path, body, customer) {
  return { method: 'POST', path, body, query: new URLSearchParams(), headers: { authorization: `Bearer ${signSessionToken({ userId: customer.id, email: customer.email, role: 'customer', sessionVersion: 1 })}` } };
}
function calendar(uid, start, end, extra = '') {
  return `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:${uid}\nSUMMARY:Audit appointment\nDTSTART:${start}\nDTEND:${end}\n${extra}END:VEVENT\nEND:VCALENDAR`;
}
const icsDate = iso => iso.replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}/, '');
const dataFeed = body => `data:text/calendar,${encodeURIComponent(body)}`;

test('01 public reset reveals a usable code under NODE_ENV=production', async () => {
  const { platform, customer } = await fixture();
  const controller = new AuthController(platform);
  process.env.NODE_ENV = 'production';
  try {
    const reply = response();
    await controller.handle({ method:'POST', path:'/api/auth/password-reset/request', body:{email:customer.email}, headers:{}, query:new URLSearchParams() }, reply);
    const reset = JSON.parse(reply.data);
    assert.match(reset.resetCodePreview, /^\d{6}$/);
    assert.ok(reset.resetUrlPreview.includes(reset.resetCodePreview));
    const confirmed = response();
    await controller.handle({ method:'POST', path:'/api/auth/password-reset/confirm', body:{email:customer.email, resetCode:reset.resetCodePreview, newPassword:'Changed123!'}, headers:{}, query:new URLSearchParams() }, confirmed);
    assert.equal(verifySessionToken(JSON.parse(confirmed.data).session.token).userId, customer.id);
  } finally { process.env.NODE_ENV = 'test'; }
});

test('02 reset requests and wrong-code attempts are not throttled', async () => {
  const { platform, customer } = await fixture();
  let reset;
  for (let i=0; i<8; i++) reset = await platform.requestPasswordReset({ email:customer.email });
  for (let i=0; i<12; i++) await assert.rejects(platform.confirmPasswordReset({email:customer.email, resetCode:'000000', newPassword:'Changed123!'}), /Invalid password reset code/);
  const user = await platform.confirmPasswordReset({ email:customer.email, resetCode:reset.resetCodePreview, newPassword:'Changed123!' });
  assert.equal(user.id, customer.id);
});

test('03 unverified OAuth email links to an existing password account', async () => {
  const { platform, repository, customer } = await fixture();
  const controller = new AuthController(platform);
  const envelope = await controller.resolveSocialIdentity({provider:'google', role:'customer', mode:'login', redirectUri:'http://localhost:3000/auth/complete'}, {provider:'google', subject:'unverified-audit-subject', email:customer.email, emailVerified:false, fullName:'Audit'});
  assert.equal(verifySessionToken(envelope.session.token).userId, customer.id);
  assert.equal((await repository.findAuthIdentityByUserId(customer.id)).googleSubject, 'unverified-audit-subject');
});

test('04 OAuth callback succeeds without state', async () => {
  const { platform, customer } = await fixture();
  const controller = new AuthController(platform);
  controller.socialAuth.exchangeCode = async () => ({provider:'google', subject:'audit-subject', email:customer.email, emailVerified:true, fullName:'Audit'});
  const reply = response();
  await controller.handle({method:'GET', path:'/api/auth/google/callback', query:new URLSearchParams({code:'stubbed-code'}), headers:{}, body:undefined}, reply);
  const redirect = new URL(reply.getHeader('Location'));
  assert.equal(redirect.searchParams.get('authStatus'), 'success');
  assert.ok(redirect.searchParams.get('token'));
});

test('05 booking HTTP controller accepts an injected customerId', async () => {
  const { platform, repository, customer, payload } = await fixture();
  const victim = await platform.registerUser({fullName:'Other Customer', email:'audit-other@example.com', phone:'555-0201', role:'customer', address:payload.serviceAddress});
  const reply = response();
  await new MarketplaceController(platform).handle(authContext('/api/bookings', {...payload, customerId:victim.id}, customer), reply);
  assert.equal(reply.status, 201);
  const booking = JSON.parse(reply.data);
  assert.equal(booking.customerId, victim.id);
  assert.equal((await repository.findBookingById(booking.id)).customerId, victim.id);
});

test('06 client-selected price reaches checkout unchanged', async () => {
  const { platform, customer, payload, gateway } = await fixture();
  const booking = await platform.createBooking(customer.id, {...payload, totalCents:100});
  let charged;
  const original = gateway.createCheckoutSession;
  gateway.createCheckoutSession = async input => { charged=input.booking.totalCents; return original(input); };
  await platform.createCheckoutSession(customer.id, {bookingId:booking.id});
  assert.equal(charged, 100);
});

test('07 rejected provider with no credentials accepts and confirms booking', async () => {
  const { platform, repository, provider, customer, payload } = await fixture();
  await repository.updateProvider(provider.id, {verificationStatus:'rejected', credentials:[], categories:[]});
  const booking = await platform.createBooking(customer.id, payload);
  assert.equal((await platform.confirmBooking(provider.id, {bookingId:booking.id})).status, 'confirmed');
});

test('08 booking accepts an end before its start', async () => {
  const { platform, customer, payload } = await fixture();
  const booking = await platform.createBooking(customer.id, {...payload, scheduledEndIso:future(70)});
  assert.ok(Date.parse(booking.scheduledEndIso) < Date.parse(booking.scheduledStartIso));
});

test('09 failed initial booking leaves an active recurring plan', async () => {
  const { platform, repository, provider, customer, payload } = await fixture();
  await repository.updateProvider(provider.id, {minimumBookingLeadHours:200});
  await assert.rejects(platform.createRecurringServicePlan(customer.id, {...payload, frequency:'weekly'}), /advance/);
  const plans = await repository.listRecurringServicePlans();
  assert.equal(plans.length, 1);
  assert.equal(plans[0].status, 'active');
  assert.equal((await repository.listBookings()).filter(b => b.recurringPlanId === plans[0].id).length, 0);
});

test('10 importing calendar B deletes calendar A blocks', async () => {
  const { platform, repository, provider } = await fixture();
  for (const [uid, hours] of [['A',96], ['B',120]]) await platform.createProviderCalendarImport(provider.id, {title:uid, provider:'other', feedUrl:dataFeed(calendar(uid,icsDate(future(hours)),icsDate(future(hours+1))))});
  const saved = await repository.findProviderById(provider.id);
  assert.equal(saved.calendarConnection.externalSubscriptions.length, 2);
  assert.equal(saved.calendarConnection.externalBlocks.length, 1);
  assert.ok(saved.calendarConnection.externalBlocks[0].id.endsWith(':B'));
});

test('11 calendar import passes a loopback URL directly to fetch', async () => {
  const { platform, provider } = await fixture();
  const originalFetch = globalThis.fetch;
  let seen;
  globalThis.fetch = async url => { seen=String(url); return new Response(calendar('local',icsDate(future(96)),icsDate(future(97)))); };
  try {
    await platform.createProviderCalendarImport(provider.id, {title:'local',provider:'other',feedUrl:'http://127.0.0.1:4001/private-calendar'});
    assert.equal(seen, 'http://127.0.0.1:4001/private-calendar');
  } finally { globalThis.fetch = originalFetch; }
});

test('12 ICS TZID is ignored on a UTC server', async () => {
  const { platform } = await fixture();
  const date = platform.readIcsDate('DTSTART;TZID=America/New_York:20260910T090000', 'DTSTART');
  assert.equal(date.toISOString(), '2026-09-10T09:00:00.000Z');
  assert.notEqual(date.toISOString(), '2026-09-10T13:00:00.000Z');
});

test('13 recurring ICS event yields only its first block', async () => {
  const { platform } = await fixture();
  const blocks = platform.parseExternalCalendarFeed({icsBody:calendar('recurring',icsDate(future(96)),icsDate(future(97)),'RRULE:FREQ=WEEKLY;COUNT=3\n'),subscriptionId:'audit-feed',title:'Recurring'});
  assert.equal(blocks.length, 1);
});

test('14 second checkout overwrites the first and drops its completion webhook', async () => {
  const { platform, repository, customer, payload } = await fixture();
  const booking = await platform.createBooking(customer.id, payload);
  const first = await platform.createCheckoutSession(customer.id, {bookingId:booking.id});
  const oldSessionId = first.payment.checkoutSessionId;
  const second = await platform.createCheckoutSession(customer.id, {bookingId:booking.id});
  assert.notEqual(oldSessionId, second.payment.checkoutSessionId);
  assert.equal(await repository.findPaymentByCheckoutSessionId(oldSessionId), undefined);
  const received = await platform.processStripeWebhook(JSON.stringify({type:'checkout.session.completed', checkoutSessionId:oldSessionId, paid:true, paymentIntentId:`pi_${oldSessionId}`}), 'stub');
  assert.equal(received.paymentId, undefined);
  assert.equal((await repository.listPayments())[0].status, 'pending');
});

test('15 delayed checkout completion changes refunded payment back to captured', async () => {
  const { platform, repository, customer, payload } = await fixture();
  const booking = await platform.createBooking(customer.id, payload);
  const checkout = await platform.createCheckoutSession(customer.id, {bookingId:booking.id});
  const paymentId = checkout.payment.id;
  const sessionId = checkout.payment.checkoutSessionId;
  const intentId = checkout.payment.processorPaymentIntentId;
  await platform.processStripeWebhook(JSON.stringify({type:'charge.refunded', paymentIntentId:intentId}), 'stub');
  assert.equal((await repository.findPaymentByCheckoutSessionId(sessionId)).status, 'refunded');
  await platform.processStripeWebhook(JSON.stringify({type:'checkout.session.completed', checkoutSessionId:sessionId, paymentIntentId:intentId, paid:true}), 'stub');
  const saved = await repository.findPaymentByCheckoutSessionId(sessionId);
  assert.equal(saved.id, paymentId);
  assert.equal(saved.status, 'captured');
  assert.equal((await repository.findBookingById(booking.id)).status, 'refunded');
});
