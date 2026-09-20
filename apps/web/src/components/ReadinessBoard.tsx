"use client";
import {useEffect,useState} from "react";
import {useI18n} from "@yardmatch/i18n/react";
import {getWebApiBaseUrl,loadStoredSession} from "../lib/api";
type Readiness = {scheduler:{enabled:boolean;overdue:boolean;lastRunAt?:string;failedSweeps:number};
  analytics:{pendingWrites:number;dropped:number;lastFailureAt?:string};credentialReviewDue:Array<{providerId:string;type:string;expiresAt:string}>};
type Request = {id:string;userId:string;kind:string;status:string;requestedAt:string};
export function ReadinessBoard() {
  const i18n=useI18n();
  const [data,setData]=useState<Readiness>(),[requests,setRequests]=useState<Request[]>([]),[error,setError]=useState(false);
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [working,setWorking]=useState(false);
  async function load() {
    const headers={Authorization:`Bearer ${loadStoredSession()?.token ?? ""}`};
    const [health,privacy]=await Promise.all([fetch(`${getWebApiBaseUrl()}/api/observability/readiness`,{headers}),fetch(`${getWebApiBaseUrl()}/api/ops/privacy-requests`,{headers})]);
    if (!health.ok || !privacy.ok) throw new Error();
    setData(await health.json());setRequests((await privacy.json()).requests);setError(false);
  }
  useEffect(()=>{void load().catch(()=>setError(true));},[]);
  async function review(id:string) {
    setWorking(true);
    try {
      const response=await fetch(`${getWebApiBaseUrl()}/api/ops/privacy-requests`,{method:"POST",headers:{Authorization:`Bearer ${loadStoredSession()?.token ?? ""}`,"content-type":"application/json"},body:JSON.stringify({id,status:"in-review",notes:notes[id]})});
      if (!response.ok) throw new Error();
      await load();
    } catch {setError(true);} finally {setWorking(false);}
  }
  return <section className="card stack-lg"><h2>{i18n.t("readiness.title")}</h2>
    {error?<p role="alert">{i18n.t("analytics.unavailable")}</p>:null}
    {data?<>
      <p>{i18n.t(!data.scheduler.enabled?"readiness.scheduler_disabled":data.scheduler.overdue||data.scheduler.failedSweeps?"readiness.scheduler_overdue":"readiness.scheduler_ok")}</p>
      <p>{i18n.t("readiness.last_run")}: {data.scheduler.lastRunAt ?? "—"}</p>
      <p>{i18n.t("readiness.credentials")}: {data.credentialReviewDue.length}</p>
      <ul>{data.credentialReviewDue.map((item,index)=><li key={`${item.providerId}-${index}`}>{item.providerId} · {item.type} · {item.expiresAt}</li>)}</ul>
      <p>{i18n.t("analytics.pending")}: {data.analytics.pendingWrites} · {i18n.t("analytics.dropped")}: {data.analytics.dropped}</p>
    </>:null}
    <h3>{i18n.t("privacy.requests")}</h3>
    {requests.map(request=><article className="list-panel" key={request.id}>
      <h4>{request.kind.replaceAll("-"," ")}</h4><p>{request.userId} · {request.status} · {request.requestedAt}</p>
      <label>{i18n.t("privacy.review_notes")}<textarea minLength={15} maxLength={2000} value={notes[request.id] ?? ""} onChange={event=>setNotes({...notes,[request.id]:event.target.value})}/></label>
      <button type="button" className="button-secondary" disabled={working || (notes[request.id]?.trim().length ?? 0)<15} onClick={()=>void review(request.id)}>{i18n.t("privacy.take_review")}</button>
    </article>)}
  </section>;
}
