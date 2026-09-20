import {type ReactNode, useEffect, useState} from "react";
import {AppState, Pressable, Text, View} from "react-native";
import {useI18n} from "@yardmatch/i18n/react";
import {getProviderMobileApiBaseUrl} from "../lib/api";
const currentVersion = "0.1.0";
export function ReleaseGate({children}: {children: ReactNode}) {
  const i18n=useI18n();
  const [state,setState]=useState<"ready"|"paused"|"update">("ready");
  async function check() {
    try {
      const response=await fetch(`${getProviderMobileApiBaseUrl()}/api/mobile/release-policy?app=provider`, {signal:AbortSignal.timeout(5000)});
      if (!response.ok) return;
      const policy=await response.json() as {minimumVersion:string;maintenance:boolean};
      if (!/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(policy.minimumVersion)) return;
      const required=policy.minimumVersion.split(".").map(Number), current=currentVersion.split(".").map(Number);
      let outdated=false;
      for(let index=0;index<3;index++) if(required[index]!==current[index]) {outdated=required[index]>current[index];break;}
      setState(policy.maintenance?"paused":outdated?"update":"ready");
    } catch { /* Network errors leave existing offline behavior intact; API enforces policy. */ }
  }
  useEffect(()=>{
    void check();
    const subscription=AppState.addEventListener("change",next=>{if(next==="active") void check();});
    return ()=>subscription.remove();
  },[]);
  if(state==="ready") return children;
  return <View style={{flex:1,justifyContent:"center",padding:24,gap:20}}>
    <Text accessibilityRole="header">{i18n.t(state==="paused"?"release.paused":"release.update")}</Text>
    <Pressable accessibilityRole="button" onPress={()=>void check()}><Text>{i18n.t("release.retry")}</Text></Pressable>
  </View>;
}
