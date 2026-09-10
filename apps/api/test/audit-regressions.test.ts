// Regression coverage for the 15 audit findings. Vendors and identities are isolated fixtures.
// Run from repository root: node --import tsx --test apps/api/test/audit-regressions.test.ts
// Uses disposable in-memory fixtures and stubbed vendors; never connects to a database.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DataEngineeringLogger } from '@yardmatch/analytics';
import { InMemoryMarketplaceRepository } from '../src/repositories/InMemoryMarketplaceRepository.ts';
import { MarketplacePlatformService } from '../src/services/MarketplacePlatformService.ts';
import { AuthController } from '../src/controllers/AuthController.ts';
import { MarketplaceController } from '../src/controllers/MarketplaceController.ts';
import { parseCalendarFeed } from '../src/services/calendarParser';
import { isPublicCalendarAddress, resolveCalendarTarget } from '../src/integrations/calendarFeed';
import { hashPassword, signSessionToken, verifySessionToken } from '../src/auth.ts';

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
  const quote = await platform.createInstantQuote({ customerId:customer.id, address:provider.address, category:'lawn-mowing' });
  payload.totalCents = quote.estimatedPriceCents;
  payload.quoteToken = quote.quoteToken;
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

test('01 deployed reset hides secrets and delivers them privately', async () => {
  const { platform, customer } = await fixture();
  const controller = new AuthController(platform);
  let delivery;
  platform.notificationDelivery.dispatch = async input => { delivery=input; return {provider:'test',sentAt:new Date().toISOString(),externalId:'test'}; };
  process.env.NODE_ENV = 'production';
  try {
    const reply = response();
    await controller.handle({ method:'POST', path:'/api/auth/password-reset/request', body:{email:customer.email}, headers:{}, query:new URLSearchParams() }, reply);
    const reset = JSON.parse(reply.data);
    assert.equal(reset.resetCodePreview, undefined);
    assert.equal(reset.resetUrlPreview, undefined);
    assert.deepEqual(reset, await platform.requestPasswordReset({email:'nonexistent@example.com'}));
    assert.equal(delivery.destination, customer.email);
    const code = delivery.body.match(/\b[0-9]{6}\b/)[0];
    const confirmed = response();
    await controller.handle({ method:'POST', path:'/api/auth/password-reset/confirm', body:{email:customer.email, resetCode:code, newPassword:'Changed123!'}, headers:{}, query:new URLSearchParams() }, confirmed);
    assert.equal(verifySessionToken(JSON.parse(confirmed.data).session.token).userId, customer.id);
    assert.equal((await platform.listNotifications({userId:customer.id,role:'customer'})).notifications?.some(n => n.body.includes(code)), false);
  } finally { process.env.NODE_ENV = 'test'; }
});

test('02 reset requests have a cooldown and wrong attempts exhaust the challenge', async () => {
  const { platform, customer } = await fixture();
  const first = await platform.requestPasswordReset({ email:customer.email });
  for (let i=0; i<8; i++) assert.equal((await platform.requestPasswordReset({email:customer.email})).resetCodePreview, undefined);
  for (let i=0; i<5; i++) await assert.rejects(platform.confirmPasswordReset({email:customer.email,resetCode:'000000',newPassword:'Changed123!'}), /Invalid password reset code/);
  await assert.rejects(platform.confirmPasswordReset({email:customer.email,resetCode:first.resetCodePreview,newPassword:'Changed123!'}), /Too many recovery attempts/);
});

test('03 unverified OAuth email cannot link to an existing account', async () => {
  const { platform, repository, customer } = await fixture();
  const controller = new AuthController(platform);
  await assert.rejects(controller.resolveSocialIdentity({provider:'google', role:'customer', mode:'login', redirectUri:'http://localhost:3000/auth/complete'}, {provider:'google', subject:'unverified-audit-subject', email:customer.email, emailVerified:false, fullName:'Audit'}), /Verify your email/);
  assert.equal((await repository.findAuthIdentityByUserId(customer.id)).googleSubject, undefined);
});

test('04 OAuth callback rejects missing state', async () => {
  const { platform, customer } = await fixture();
  const controller = new AuthController(platform);
  controller.socialAuth.exchangeCode = async () => ({provider:'google', subject:'audit-subject', email:customer.email, emailVerified:true, fullName:'Audit'});
  const reply = response();
  await controller.handle({method:'GET', path:'/api/auth/google/callback', query:new URLSearchParams({code:'stubbed-code'}), headers:{}, body:undefined}, reply);
  const redirect = new URL(reply.getHeader('Location'));
  assert.equal(redirect.searchParams.get('authStatus'), 'error');
  assert.equal(redirect.searchParams.get('token'), null);
});

test('05 booking ignores injected customerId and retains authenticated ownership', async () => {
  const { platform, repository, customer, payload } = await fixture();
  const victim = await platform.registerUser({fullName:'Other Customer', email:'audit-other@example.com', phone:'555-0201', role:'customer', address:payload.serviceAddress});
  const reply = response();
  await new MarketplaceController(platform).handle(authContext('/api/bookings', {...payload, customerId:victim.id}, customer), reply);
  assert.equal(reply.status, 201);
  const booking = JSON.parse(reply.data);
  assert.equal(booking.customerId, customer.id);
  assert.equal((await repository.findBookingById(booking.id)).customerId, customer.id);
});

test('06 signed quote rejects client price, property, and service tampering', async () => {
  const { platform, customer, payload } = await fixture();
  await assert.rejects(platform.createBooking(customer.id, {...payload,totalCents:100}), /price does not match/);
  await assert.rejects(platform.createBooking(customer.id, {...payload,serviceAddress:{...payload.serviceAddress,line1:'Different Street'}}), /quote does not match/);
  await assert.rejects(platform.createBooking(customer.id, {...payload,quoteToken:payload.quoteToken+'tampered'}), /expired/);
  assert.equal((await platform.createBooking(customer.id,payload)).totalCents,payload.totalCents);
});

test('07 rejected, uncredentialed, unsupported, and distant providers cannot accept bookings', async () => {
  const { platform, repository, provider, customer, payload } = await fixture();
  const valid = await platform.createBooking(customer.id, payload);
  const original = structuredClone(await repository.findProviderById(provider.id));
  for (const change of [{verificationStatus:'rejected'}, {credentials:[]}, {categories:[]}, {serviceRadiusMiles:0,address:{...provider.address,point:{latitude:0,longitude:0}}}]) {
    await repository.updateProvider(provider.id, {...original,...change});
    await assert.rejects(platform.createBooking(customer.id,payload), /approved|outside/);
    await assert.rejects(platform.confirmBooking(provider.id,{bookingId:valid.id}), /approved|outside/);
  }
});

test('08 invalid and past booking windows are rejected before persistence', async () => {
  const { platform, repository, customer, payload } = await fixture();
  for (const times of [{scheduledEndIso:future(70)}, {scheduledEndIso:payload.scheduledStartIso}, {scheduledStartIso:'invalid'}, {scheduledStartIso:future(-3),scheduledEndIso:future(-2)}]) {
    await assert.rejects(platform.createBooking(customer.id,{...payload,...times}), /future service window/);
  }
  assert.equal((await repository.listBookings()).length,0);
});

test('09 failed initial booking leaves no active recurring plan', async () => {
  const { platform, repository, provider, customer, payload } = await fixture();
  await repository.updateProvider(provider.id, {minimumBookingLeadHours:200});
  await assert.rejects(platform.createRecurringServicePlan(customer.id, {...payload, frequency:'weekly'}), /advance/);
  const plans = await repository.listRecurringServicePlans();
  assert.equal(plans.length, 0);
  assert.equal((await repository.listBookings()).length,0);
});

test('10 concurrent calendar imports and refreshes preserve every feed', async () => {
  const { platform, repository, provider } = await fixture();
  await Promise.all([['A',96], ['B',120]].map(([uid,hours]) => platform.createProviderCalendarImport(provider.id, {title:uid,provider:'other',feedUrl:dataFeed(calendar(uid,icsDate(future(hours)),icsDate(future(hours+1))))})));
  const saved = await repository.findProviderById(provider.id);
  assert.equal(saved.calendarConnection.externalSubscriptions.length, 2);
  assert.equal(saved.calendarConnection.externalBlocks.length, 2);
  await Promise.all(saved.calendarConnection.externalSubscriptions.map(feed => platform.syncProviderCalendarImport(provider.id,{subscriptionId:feed.id})));
  assert.equal((await repository.findProviderById(provider.id)).calendarConnection.externalBlocks.length,2);
});

test('11 calendar destinations reject private IP forms and DNS results', async () => {
  for (const address of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.1','::1','::ffff:127.0.0.1','fc00::1','2001:db8::1']) assert.equal(isPublicCalendarAddress(address),false,address);
  for (const url of ['http://127.0.0.1/','http://2130706433/','http://[::1]/','http://[::ffff:7f00:1]/','https://user:pass@example.com/']) await assert.rejects(resolveCalendarTarget(new URL(url)), /public/);
  await assert.rejects(resolveCalendarTarget(new URL('https://calendar.example/'),async () => [{address:'10.0.0.1',family:4}]), /public/);
  assert.deepEqual(await resolveCalendarTarget(new URL('https://calendar.example/'),async () => [{address:'8.8.8.8',family:4}]),{address:'8.8.8.8',family:4});
});

test('12 calendar TZID, floating and all-day values use New York time on a UTC server', async () => {
  const now = Date.parse('2026-09-08T00:00:00Z');
  for (const dates of ['DTSTART;TZID=America/New_York:20260910T090000\nDTEND;TZID=America/New_York:20260910T100000', 'DTSTART:20260910T090000\nDTEND:20260910T100000']) {
    const blocks = await parseCalendarFeed({icsBody:'BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:tz\n'+dates+'\nEND:VEVENT\nEND:VCALENDAR',subscriptionId:'tz',title:'Timezone',now});
    assert.equal(blocks[0].startIso,'2026-09-10T13:00:00.000Z');
  }
  const allDay = await parseCalendarFeed({icsBody:'BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:day\nDTSTART;VALUE=DATE:20260910\nDTEND;VALUE=DATE:20260911\nEND:VEVENT\nEND:VCALENDAR',subscriptionId:'tz',title:'All day',now});
  assert.equal(allDay[0].startIso,'2026-09-10T04:00:00.000Z');
  assert.equal(allDay[0].endIso,'2026-09-11T04:00:00.000Z');
});

test('13 calendar recurrence expands all occurrences and respects EXDATE', async () => {
  const blocks = await parseCalendarFeed({icsBody:calendar('recurring','20260910T130000Z','20260910T140000Z','RRULE:FREQ=WEEKLY;COUNT=3\nEXDATE:20260917T130000Z\n'),subscriptionId:'audit-feed',title:'Recurring',now:Date.parse('2026-09-08T00:00:00Z')});
  assert.deepEqual(blocks.map(b=>b.startIso),['2026-09-10T13:00:00.000Z','2026-09-24T13:00:00.000Z']);
});

test('14 repeated checkout reuses its active session and retains completion tracking', async () => {
  const { platform, repository, customer, payload } = await fixture();
  const booking = await platform.createBooking(customer.id, payload);
  const first = await platform.createCheckoutSession(customer.id, {bookingId:booking.id});
  const oldSessionId = first.payment.checkoutSessionId;
  const second = await platform.createCheckoutSession(customer.id, {bookingId:booking.id});
  assert.equal(oldSessionId, second.payment.checkoutSessionId);
  assert.ok(await repository.findPaymentByCheckoutSessionId(oldSessionId));
  const received = await platform.processStripeWebhook(JSON.stringify({type:'checkout.session.completed', checkoutSessionId:oldSessionId, paid:true, paymentIntentId:`pi_${oldSessionId}`}), 'stub');
  assert.equal(received.paymentId, first.payment.id);
  assert.equal((await repository.listPayments())[0].status, 'captured');
});

test('15 delayed completion cannot resurrect refunded payments', async () => {
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
  assert.equal(saved.status, 'refunded');
  assert.equal((await repository.findBookingById(booking.id)).status, 'refunded');
});

test('recovery codes are consumed once under concurrent confirmations', async () => {
  const {platform, customer, repository} = await fixture();
  const reset = await platform.requestPasswordReset({email:customer.email});
  const outcomes = await Promise.allSettled(Array.from({length:8},()=>platform.confirmPasswordReset({email:customer.email,resetCode:reset.resetCodePreview,newPassword:'Changed123!'})));
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await repository.findAuthIdentityByUserId(customer.id)).sessionVersion,2);
});

test('OAuth state is browser-bound, provider-bound and consumed exactly once', async () => {
  const {platform, customer} = await fixture();
  const controller = new AuthController(platform);
  controller.socialAuth.isConfigured = () => true;
  controller.socialAuth.buildAuthorizationUrl = (_provider,state) => 'https://accounts.example/authorize?state='+encodeURIComponent(state);
  let exchanges = 0;
  controller.socialAuth.exchangeCode = async () => { exchanges++; return {provider:'google',subject:'valid-google',email:customer.email,emailVerified:true,fullName:customer.fullName}; };
  const start = response();
  await controller.handle({method:'GET',path:'/api/auth/google/start',headers:{},query:new URLSearchParams({role:'customer',mode:'login'}),body:undefined},start);
  const state = new URL(start.getHeader('Location')).searchParams.get('state');
  const cookie = start.getHeader('Set-Cookie').split(';')[0];
  const callback = async (headers,path='/api/auth/google/callback') => {
    const reply=response();
    await controller.handle({method:'GET',path,headers,query:new URLSearchParams({state,code:'stub'}),body:undefined},reply);
    return new URL(reply.getHeader('Location')).searchParams.get('authStatus');
  };
  assert.equal(await callback({}),'error');
  assert.equal(await callback({cookie},'/api/auth/apple/callback'),'error');
  assert.equal(exchanges,0);
  assert.equal(await callback({cookie}),'success');
  assert.equal(await callback({cookie}),'error');
  assert.equal(exchanges,1);
});

test('concurrent checkout requests and a transport retry retain the same attempt key', async () => {
  const {platform,repository,customer,payload,gateway} = await fixture();
  const booking=await platform.createBooking(customer.id,payload);
  const keys=[];
  let fail=true;
  gateway.createCheckoutSession=async input=>{
    keys.push(input.idempotencyKey);
    if(fail){fail=false;throw new Error('simulated timeout');}
    return {checkoutSessionId:'cs_shared',checkoutUrl:'https://checkout.example/shared',paymentIntentId:'pi_shared'};
  };
  await assert.rejects(platform.createCheckoutSession(customer.id,{bookingId:booking.id}),/timeout/);
  const replies=await Promise.all(Array.from({length:8},()=>platform.createCheckoutSession(customer.id,{bookingId:booking.id})));
  assert.equal(new Set(keys).size,1);
  assert.equal((await repository.listPayments()).length,1);
  assert.ok(replies.every(reply=>reply.payment.checkoutSessionId==='cs_shared'));
});

test('expired checkout replacement preserves the old attempt and its event mapping', async () => {
  const {platform,repository,customer,payload} = await fixture();
  const booking=await platform.createBooking(customer.id,payload);
  const first=await platform.createCheckoutSession(customer.id,{bookingId:booking.id});
  const oldId=first.payment.checkoutSessionId;
  const event=JSON.stringify({id:'evt_expired',type:'checkout.session.expired',checkoutSessionId:oldId});
  await platform.processStripeWebhook(event,'stub');
  const second=await platform.createCheckoutSession(customer.id,{bookingId:booking.id});
  assert.notEqual(second.payment.id,first.payment.id);
  assert.ok(await repository.findPaymentByCheckoutSessionId(oldId));
  await platform.processStripeWebhook(event,'stub');
  assert.equal((await repository.findPaymentById(second.payment.id)).status,'pending');
  assert.equal((await repository.listPayments()).length,2);
});

test('concurrent initial recurring requests produce one plan and one first occurrence', async () => {
  const {platform,repository,customer,payload} = await fixture();
  const replies=await Promise.all(Array.from({length:6},()=>platform.createRecurringServicePlan(customer.id,{...payload,frequency:'weekly'})));
  assert.equal(new Set(replies.map(reply=>reply.plan.plan.id)).size,1);
  assert.equal((await repository.listRecurringServicePlans()).length,1);
  assert.equal((await repository.listBookings()).length,1);
});

test('calendar expands RDATE and moved occurrences across daylight saving changes', async () => {
  const ics='BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:series\nDTSTART;TZID=America/New_York:20261025T090000\nDTEND;TZID=America/New_York:20261025T100000\nRRULE:FREQ=WEEKLY;COUNT=3\nRDATE;TZID=America/New_York:20261103T090000\nEND:VEVENT\nBEGIN:VEVENT\nUID:series\nRECURRENCE-ID;TZID=America/New_York:20261101T090000\nDTSTART;TZID=America/New_York:20261102T100000\nDTEND;TZID=America/New_York:20261102T110000\nEND:VEVENT\nEND:VCALENDAR';
  const blocks=await parseCalendarFeed({icsBody:ics,subscriptionId:'dst',title:'DST',now:Date.parse('2026-10-24T00:00:00Z')});
  assert.deepEqual(blocks.map(b=>b.startIso),['2026-10-25T13:00:00.000Z','2026-11-02T15:00:00.000Z','2026-11-03T14:00:00.000Z','2026-11-08T14:00:00.000Z']);
});

test('all-day calendar series preserve local midnights through the DST transition', async () => {
  const ics='BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:day-series\nDTSTART;VALUE=DATE:20261031\nDTEND;VALUE=DATE:20261101\nRRULE:FREQ=DAILY;COUNT=3\nEND:VEVENT\nEND:VCALENDAR';
  const blocks=await parseCalendarFeed({icsBody:ics,subscriptionId:'days',title:'Days',now:Date.parse('2026-10-30T00:00:00Z')});
  assert.equal(blocks[1].startIso,'2026-11-01T04:00:00.000Z');
  assert.equal(blocks[1].endIso,'2026-11-02T05:00:00.000Z');
});

test('Apple form-post callback requires the deployed host-only browser binding', async () => {
  const {platform,customer}=await fixture();
  const controller=new AuthController(platform);
  controller.socialAuth.isConfigured=()=>true;
  controller.socialAuth.buildAuthorizationUrl=(_provider,state)=>'https://appleid.apple.com/auth/authorize?state='+encodeURIComponent(state);
  let exchanges=0;
  controller.socialAuth.exchangeCode=async()=>{exchanges++; return {provider:'apple',subject:'apple-post-fixture',email:customer.email,emailVerified:true,fullName:customer.fullName};};
  process.env.NODE_ENV='production';
  try {
    const start=response();
    await controller.handle({method:'GET',path:'/api/auth/apple/start',headers:{},query:new URLSearchParams({role:'customer',mode:'login'}),body:undefined},start);
    const cookie=start.getHeader('Set-Cookie');
    assert.match(cookie,/^__Host-ym-oauth-binding=/);
    assert.match(cookie,/HttpOnly; Path=\/;/);
    assert.match(cookie,/SameSite=None; Secure/);
    const state=new URL(start.getHeader('Location')).searchParams.get('state');
    const context={method:'POST',path:'/api/auth/apple/callback',headers:{cookie:cookie.split(';')[0]},query:new URLSearchParams(),body:{state,code:'apple-code'}};
    assert.equal(controller.canHandle(context),true);
    const success=response();
    await controller.handle(context,success);
    assert.equal(new URL(success.getHeader('Location')).searchParams.get('authStatus'),'success');
    const replay=response();
    await controller.handle(context,replay);
    assert.equal(new URL(replay.getHeader('Location')).searchParams.get('authStatus'),'error');
    assert.equal(exchanges,1);
  } finally {process.env.NODE_ENV='test';}
});

test('recovery delivery failure does not disclose account existence', async()=>{
  const {platform,customer}=await fixture();
  platform.notificationDelivery.dispatch=async()=>{throw new Error('simulated email outage');};
  process.env.NODE_ENV='production';
  try {
    assert.deepEqual(await platform.requestPasswordReset({email:customer.email}),await platform.requestPasswordReset({email:'unknown@example.com'}));
  } finally {process.env.NODE_ENV='test';}
});
