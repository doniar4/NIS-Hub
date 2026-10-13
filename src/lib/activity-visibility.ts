"use client";

// This state belongs to the current browser document. Router navigation and
// router.refresh preserve it; a real reload creates a fresh, empty module.
const deferred=new Set<string>();
const listeners=new Set<()=>void>();
export function deferActivityUntilReload(userId:string) {
 if(deferred.has(userId))return;
 deferred.add(userId);
 for(const notify of listeners)notify();
}
export const activityDeferred=(userId:string)=>deferred.has(userId);
export function subscribeActivityVisibility(notify:()=>void) {
 listeners.add(notify);return()=>{listeners.delete(notify);};
}
