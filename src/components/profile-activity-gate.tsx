"use client";

import {useEffect,useSyncExternalStore,type ReactNode} from "react";
import {activityDeferred,deferActivityUntilReload,subscribeActivityVisibility} from "@/lib/activity-visibility";

export function ProfileActivityGate({userId,complete,children}:{userId:string;complete:boolean;children:ReactNode}) {
 const visible=useSyncExternalStore(subscribeActivityVisibility,()=>complete&&!activityDeferred(userId),()=>false);
 useEffect(()=>{if(!complete)deferActivityUntilReload(userId);},[userId,complete]);
 return visible?children:null;
}
