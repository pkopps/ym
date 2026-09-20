const base=process.env.API_BASE_URL, token=process.env.OPS_AUTOMATION_TOKEN;
if(!base||!token||token.length<32) throw new Error('Configure the monitor API origin and scheduler token.');
const url=new URL('/api/observability/ops-automation/health',base);
if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname)) throw new Error('Monitor requires HTTPS.');
const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});
if(!response.ok) throw new Error(`Operations health failed (${response.status}); inspect the authenticated readiness dashboard.`);
console.log('Operations cadence and collection health passed.');
