"use client";
import {useState} from "react";
import {useI18n} from "@yardmatch/i18n/react";
import {getWebApiBaseUrl, loadStoredSession} from "../lib/api";
export function PrivacyRequestPanel() {
  const i18n=useI18n();
  const [kind,setKind]=useState("data-export"), [status,setStatus]=useState<"idle"|"sending"|"sent"|"failed">("idle");
  async function submit() {
    setStatus("sending");
    try {
      const response=await fetch(`${getWebApiBaseUrl()}/api/account/privacy-requests`,{method:"POST",
        headers:{"content-type":"application/json",Authorization:`Bearer ${loadStoredSession()?.token ?? ""}`}, body:JSON.stringify({kind})});
      if (!response.ok) throw new Error();
      setStatus("sent");
    } catch { setStatus("failed"); }
  }
  return <section className="card stack-lg" data-analytics-private>
    <h2>{i18n.t("privacy.requests")}</h2><p>{i18n.t("privacy.explanation")}</p>
    <label>{i18n.t("privacy.request_type")} <select value={kind} onChange={event=>setKind(event.target.value)}>
      <option value="data-export">{i18n.t("privacy.export")}</option><option value="account-deletion">{i18n.t("privacy.delete")}</option><option value="photo-removal">{i18n.t("privacy.photos")}</option>
    </select></label>
    <button className="button" type="button" disabled={status==="sending"} onClick={()=>void submit()}>{i18n.t("privacy.send")}</button>
    {status==="sent"?<p role="status">{i18n.t("privacy.sent")}</p>:null}
    {status==="failed"?<p role="alert">{i18n.t("privacy.failed")}</p>:null}
  </section>;
}
