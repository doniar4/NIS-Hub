import test from "node:test";
import assert from "node:assert/strict";
import {canShowProfileActivity,profileCompletion,type CompletionProfile} from "../src/lib/profile-completion";

const profile:CompletionProfile={id:"owner",school_id:"oral",onboarding_completed_at:"2026-10-13",display_name:"Ученик",class_id:"class",avatar_path:"owner/avatar.webp"};
const top=["physics","math","biology","chemistry"];
test("Activity requires all five persisted profile steps; Bio is optional",()=>{
 assert.equal(canShowProfileActivity(profile,top),true);
 for(const patch of [{school_id:null},{school_id:"unknown"},{display_name:"  "},{class_id:null},{avatar_path:null},{avatar_path:"other/avatar.webp"},{onboarding_completed_at:null}]){
  assert.equal(canShowProfileActivity({...profile,...patch},top),false);
 }
 for(const choices of [[],top.slice(0,1),top.slice(0,3),[...top.slice(0,3),""],[...top.slice(0,3),top[0]]])assert.equal(canShowProfileActivity(profile,choices),false);
 assert.deepEqual(profileCompletion(profile,top),{school:true,name:true,cls:true,avatar:true,top:true});
});
