"use client";

export type SceneView = "2d" | "3d";

export function SceneViewToggle({view,onChange,label,flatLabel="2D",volumeLabel="3D",className=""}:{
 view:SceneView;onChange:(view:SceneView)=>void;label:string;flatLabel?:string;volumeLabel?:string;className?:string;
}) {
 return <div className={`scene-view-switch ${className}`} role="group" aria-label={label} data-view={view}>
  <span className="scene-view-thumb" aria-hidden="true"/>
  {(["2d","3d"] as const).map(mode=><button type="button" key={mode} aria-pressed={view===mode}
   aria-label={mode==="2d"?flatLabel:volumeLabel} title={mode==="2d"?flatLabel:volumeLabel} onClick={()=>onChange(mode)}>
   <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    {mode==="2d"?<><rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" fill="currentColor"/><rect x="9" y="1.5" width="5.5" height="5.5" rx="1" fill="currentColor"/><rect x="1.5" y="9" width="5.5" height="5.5" rx="1" fill="currentColor"/><rect x="9" y="9" width="5.5" height="5.5" rx="1" fill="currentColor"/></>
     :<path d="M8 1.2 14.2 4.6v6.8L8 14.8 1.8 11.4V4.6ZM1.8 4.6 8 8l6.2-3.4M8 8v6.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>}
   </svg>
  </button>)}
 </div>;
}
