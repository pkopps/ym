import assert from "node:assert/strict";
import {test} from "node:test";
import {PrismaClient} from "@prisma/client";
import {ProductAnalytics} from "../src/observability/ProductAnalytics";
const url=process.env.TEST_DATABASE_URL;
test("Postgres analytics survives restart, deduplicates across instances, retains bounded history and exports only permissioned events",{skip:!url},async()=>{
  const prisma=new PrismaClient({datasourceUrl:url});
  const original={environment:process.env.YARDMATCH_ENV,key:process.env.POSTHOG_API_KEY,host:process.env.POSTHOG_HOST,hash:process.env.ANALYTICS_IDENTITY_HASH_KEY,fetch:globalThis.fetch};
  const id=crypto.randomUUID(),serverId=crypto.randomUUID(),oldId=crypto.randomUUID();
  try {
    process.env.YARDMATCH_ENV="production";
    delete process.env.POSTHOG_API_KEY;
    const event={id,name:"page_viewed",occurredAt:new Date().toISOString(),properties:{anonymousId:crypto.randomUUID(),sessionId:crypto.randomUUID(),consent:true,origin:"client"}};
    const a=new ProductAnalytics(prisma),b=new ProductAnalytics(prisma);
    a.record(event);b.record(event);await Promise.all([a.flush(),b.flush()]);
    assert.equal(await prisma.productAnalyticsEvent.count({where:{id}}),1);
    const restarted=new ProductAnalytics(prisma);await restarted.restore();restarted.record(event);
    assert.equal(restarted.listEvents().filter(item=>item.id===id).length,1);
    a.record({id:serverId,name:"payment_captured",occurredAt:new Date().toISOString(),actorId:"booking-private",properties:{totalCents:10000}});
    await a.flush();
    await prisma.productAnalyticsEvent.create({data:{id:oldId,name:"old",occurredAt:new Date(),receivedAt:new Date(Date.now()-100*86400_000),environment:"production",source:"server",properties:{}}});
    process.env.POSTHOG_API_KEY="test-token";process.env.POSTHOG_HOST="https://analytics.example.invalid";process.env.ANALYTICS_IDENTITY_HASH_KEY="a".repeat(32);
    let delivered:Record<string,unknown>[]=[];
    globalThis.fetch=async (_input,init)=>{delivered=JSON.parse(String(init?.body)).batch;return new Response("",{status:503});};
    await a.maintenance();
    assert.equal(await prisma.productAnalyticsEvent.count({where:{id:oldId}}),0);
    assert.equal((await prisma.productAnalyticsEvent.findUniqueOrThrow({where:{id}})).attempts,1);
    assert.match(String(delivered[0].uuid),/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    const deliveredUuid=delivered[0].uuid;
    assert.equal(delivered.length,1);assert.equal(delivered[0].event,"page_viewed");
    assert.notEqual(delivered[0].distinct_id,event.properties.anonymousId);
    await prisma.productAnalyticsEvent.update({where:{id},data:{nextAttemptAt:new Date()}});
    globalThis.fetch=async(_input,init)=>{assert.equal(JSON.parse(String(init?.body)).batch[0].uuid,deliveredUuid);return new Response("",{status:200});};await a.maintenance();
    assert.ok((await prisma.productAnalyticsEvent.findUniqueOrThrow({where:{id}})).exportedAt);
    assert.equal((await prisma.productAnalyticsEvent.findUniqueOrThrow({where:{id:serverId}})).exportedAt,null);
  } finally {
    globalThis.fetch=original.fetch;
    for(const [key,value] of Object.entries({YARDMATCH_ENV:original.environment,POSTHOG_API_KEY:original.key,POSTHOG_HOST:original.host,ANALYTICS_IDENTITY_HASH_KEY:original.hash})) {
      if(value===undefined) delete process.env[key];else process.env[key]=value;
    }
    await prisma.productAnalyticsEvent.deleteMany({where:{id:{in:[id,serverId,oldId]}}});await prisma.$disconnect();
  }
});

test("photo review inventory holds disputed evidence and never deletes records",{skip:!url},async()=>{
  const prisma=new PrismaClient({datasourceUrl:url});
  const ids=[crypto.randomUUID(),crypto.randomUUID()];
  const old=new Date(Date.now()-180*86400_000);
  try {
    for(const [index,id] of ids.entries()) await prisma.booking.create({data:{id,customerId:"synthetic-customer",providerId:"synthetic-provider",
      serviceAddress:{},category:"lawn-mowing",requestedAt:old,scheduledStartIso:old,scheduledEndIso:old,status:"completed",
      completedAt:old,disputedAt:index?new Date():null,notes:"Synthetic retention verification",totalCents:100,
      serviceEvidence:[{id:`photo-${id}`}],interventions:[],addressChangeHistory:[]}});
    const {execFileSync}=await import("node:child_process");
    const output=execFileSync(process.execPath,["../../scripts/inspect-data-lifecycle.mjs"],{encoding:"utf8",env:{...process.env,DATABASE_URL:url!,PHOTO_RETENTION_REVIEW_DAYS:"90"}});
    const inventory=JSON.parse(output);
    assert.ok(inventory.photosForReview>=1);assert.ok(inventory.disputedBookingsHeld>=1);
    assert.equal(inventory.photosDeleted,0);assert.equal(inventory.financialRecordsDeleted,0);
    assert.equal(await prisma.booking.count({where:{id:{in:ids}}}),2);
  } finally {await prisma.booking.deleteMany({where:{id:{in:ids}}});await prisma.$disconnect();}
});

test("Postgres analytics workers drain a multi-batch backlog without overlapping claims and recover expired leases", {skip:!url}, async () => {
  const prisma = new PrismaClient({datasourceUrl:url});
  const prefix = `scale-export-${crypto.randomUUID()}`;
  const keys = ["YARDMATCH_ENV", "POSTHOG_API_KEY", "POSTHOG_HOST", "ANALYTICS_IDENTITY_HASH_KEY"];
  const previous = keys.map(key => process.env[key]), originalFetch = globalThis.fetch;
  try {
    process.env.YARDMATCH_ENV = "production";
    process.env.POSTHOG_API_KEY = "isolated-test-token";
    process.env.POSTHOG_HOST = "https://analytics.example.invalid";
    process.env.ANALYTICS_IDENTITY_HASH_KEY = "isolated-test-identity-key".repeat(2);
    const now = new Date();
    await prisma.productAnalyticsEvent.createMany({ data: Array.from({length:1201}, (_, index) => ({
      id: `${prefix}-${index}`, name: "page_viewed", occurredAt: now, environment: "production", source: "client",
      properties: {consent:true, origin:"client", anonymousId:"scale-test"},
      ...(index === 0 ? {exportLeaseToken:"abandoned-worker", exportLeaseExpiresAt:new Date(Date.now()-1000), attempts:1} : {})
    })) });
    const sent = new Set<string>(), batchSizes:number[] = [];
    globalThis.fetch = async (_input, init) => {
      const batch = JSON.parse(String(init?.body)).batch;
      batchSizes.push(batch.length);
      for (const item of batch) {
        const id = item.properties.$insert_id;
        assert.equal(sent.has(id), false, `Duplicate concurrent export: ${id}`); sent.add(id);
      }
      await new Promise(resolve => setTimeout(resolve, 5));
      return new Response("", {status:200});
    };
    const a = new ProductAnalytics(prisma), b = new ProductAnalytics(prisma);
    await Promise.all([a.maintenance(), a.maintenance(), b.maintenance()]);
    assert.equal(sent.size, 1201); assert.ok(batchSizes.length >= 3); assert.ok(batchSizes.every(size => size <= 500));
    assert.equal(await prisma.productAnalyticsEvent.count({where:{id:{startsWith:prefix}, exportedAt:null}}), 0);
    assert.equal((await prisma.productAnalyticsEvent.findUniqueOrThrow({where:{id:`${prefix}-0`}})).attempts, 2);
    await Promise.all([a.drain(), b.drain()]);
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key,index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; });
    await prisma.productAnalyticsEvent.deleteMany({where:{id:{startsWith:prefix}}}); await prisma.$disconnect();
  }
});
