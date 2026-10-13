import {createRoot} from "react-dom/client";
import {useState} from "react";
import {LocaleProvider} from "../../src/components/locale-provider";
import {FirstVisitGuide} from "../../src/components/first-visit-guide";
import {ProfileActivityGate} from "../../src/components/profile-activity-gate";
import {ProfileActivity} from "../../src/components/profile-activity";
import {canShowProfileActivity,type CompletionProfile} from "../../src/lib/profile-completion";
const storage="first-visit-fixture",top=["math","physics","biology","chemistry"];
const ready:CompletionProfile={id:"fixture-user",school_id:"oral",onboarding_completed_at:"2026-10-13",display_name:"Айдана",class_id:"9A",avatar_path:"fixture-user/avatar.webp"};
const empty={...ready,class_id:null,avatar_path:null};
function Harness(){
 const [state,setState]=useState<{profile:CompletionProfile;top:string[]}>(()=>JSON.parse(localStorage.getItem(storage)??JSON.stringify({profile:empty,top:[]})));
 const [route,setRoute]=useState("profile");
 const locale=new URLSearchParams(location.search).get("locale")==="en"?"en":new URLSearchParams(location.search).get("locale")==="kk"?"kk":"ru";
 const save=(profile:CompletionProfile,choices:string[])=>{const next={profile,top:choices};localStorage.setItem(storage,JSON.stringify(next));setState(next);};
 const complete=canShowProfileActivity(state.profile,state.top);
 return <LocaleProvider locale={locale}><main style={{maxWidth:1000,padding:24,margin:"auto"}}>
  <nav aria-label="Fixture controls" style={{display:"flex",flexWrap:"wrap",gap:16,marginBottom:20}}>
   <button onClick={()=>save(ready,top)}>Complete profile</button><button onClick={()=>save({...ready,avatar_path:null},top)}>Remove photo</button>
   <button onClick={()=>setRoute("library")}>Visit library</button><button onClick={()=>setRoute("profile")}>Return to profile</button>
  </nav>
  {route==="profile"?<>
   {!complete&&<FirstVisitGuide profile={state.profile} top={state.top} locale={locale} classAvailable/>}
   <ProfileActivityGate userId={state.profile.id} complete={complete}><ProfileActivity initial={{today:"2026-10-13",days:[{date:"2026-10-13",count:1}]}}/></ProfileActivityGate>
   <section className="surface-card"><div id="profile-name">Name</div><div id="profile-class">Class</div><div id="profile-avatar">Photo</div><div id="profile-subjects">Top 4</div><div id="school-settings">School</div></section>
  </>:<p>Library</p>}
 </main></LocaleProvider>;
}
createRoot(document.getElementById("root")!).render(<Harness/>);
