import assert from "node:assert/strict";
import {test} from "node:test";
import {PrivacyController} from "../src/controllers/PrivacyController";
import {ReadinessController} from "../src/controllers/ReadinessController";
import {ProductAnalytics} from "../src/observability/ProductAnalytics";
import {signSessionToken} from "../src/auth";
import type {MarketplacePlatformService} from "../src/services/MarketplacePlatformService";
import type {RequestContext} from "../src/http";
const identities = ["customer-a","customer-b","ops-a"].map(userId=>({userId,email:`${userId}@example.com`,role:userId.startsWith("ops")?"ops" as const:"customer" as const,sessionVersion:1}));
const platform = {findAuthIdentityByUserId: async (id:string)=>identities.find(identity=>identity.userId===id),
  listOpsAutomationRuns: async ()=>({runs:[]}),
  runDueOpsAutomation: async (_actor:unknown,body:{dryRun:boolean})=>({dryRun:body.dryRun,failedSweepCount:0})} as unknown as MarketplacePlatformService;
function context(path:string,method:string,user=0,body:unknown={}):RequestContext {
  return {path,method,body,query:new URLSearchParams(),headers:{authorization:`Bearer ${signSessionToken(identities[user])}`}};
}
function response() {
  let payload="",status=0;
  return {setHeader(){},writeHead(code:number){status=code;},end(text:string){payload=text;},json:()=>JSON.parse(payload),status:()=>status};
}
test("privacy intake isolates accounts, deduplicates open requests, and retains review audit",async()=>{
  const controller=new PrivacyController(platform), first=response();
  await assert.rejects(controller.handle({...context("/api/account/privacy-requests","GET"),headers:{}},response() as never),/bearer/);
  await controller.handle(context("/api/account/privacy-requests","POST",0,{kind:"account-deletion"}),first as never);
  const duplicate=response();
  await controller.handle(context("/api/account/privacy-requests","POST",0,{kind:"account-deletion"}),duplicate as never);
  assert.equal(first.json().id,duplicate.json().id);
  const other=response();await controller.handle(context("/api/account/privacy-requests","GET",1),other as never);
  assert.equal(other.json().requests.length,0);
  await assert.rejects(controller.handle(context("/api/ops/privacy-requests","GET",0),response() as never),/ops/);
  for (const status of ["in-review","retention-required"]) {
    const review=response();
    await controller.handle(context("/api/ops/privacy-requests","POST",2,{id:first.json().id,status,notes:"Retain financial records pending the approved retention policy."}),review as never);
    assert.equal(review.json().reviewedBy,"ops-a");
  }
  const list=response();await controller.handle(context("/api/account/privacy-requests","GET",0),list as never);
  assert.equal(list.json().requests[0].audit.length,2);
  await assert.rejects(controller.handle(context("/api/ops/privacy-requests","POST",2,{id:first.json().id,status:"fulfilled",notes:"Delete everything immediately"}),response() as never),/review status/);
});
test("scheduler rejects missing or invalid identity and keeps live execution disabled by default",async()=>{
  const saved={token:process.env.OPS_AUTOMATION_TOKEN,user:process.env.OPS_AUTOMATION_USER_ID,enabled:process.env.OPS_AUTOMATION_ENABLED};
  try {
    process.env.OPS_AUTOMATION_TOKEN="t".repeat(32);process.env.OPS_AUTOMATION_USER_ID="ops-a";delete process.env.OPS_AUTOMATION_ENABLED;
    const controller=new ReadinessController(platform,new ProductAnalytics());
    const ctx=context("/api/observability/ops-automation/scheduled","POST");
    await assert.rejects(controller.handle(ctx,response() as never),/scheduler identity/);
    ctx.headers.authorization=`Bearer ${"é".repeat(32)}`;
    await assert.rejects(controller.handle(ctx,response() as never),/scheduler identity/);
    ctx.headers.authorization=`Bearer ${process.env.OPS_AUTOMATION_TOKEN}`;
    const dry=response();await controller.handle(ctx,dry as never);assert.equal(dry.json().dryRun,true);
    await assert.rejects(controller.handle({...ctx,body:{dryRun:false}},response() as never),/not enabled/);
    const health=response();
    await controller.handle({...ctx,path:"/api/observability/ops-automation/health",method:"GET"},health as never);
    assert.equal(health.status(),503);assert.equal(health.json().overdue,true);
    process.env.OPS_AUTOMATION_USER_ID="customer-a";
    await assert.rejects(controller.handle(ctx,response() as never),/active named ops/);
  } finally {
    for(const [key,value] of Object.entries({OPS_AUTOMATION_TOKEN:saved.token,OPS_AUTOMATION_USER_ID:saved.user,OPS_AUTOMATION_ENABLED:saved.enabled})) {
      if(value===undefined) delete process.env[key];else process.env[key]=value;
    }
  }
});
