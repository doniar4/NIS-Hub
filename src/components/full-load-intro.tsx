"use client";
import {useEffect,useRef} from "react";
import {usePathname} from "next/navigation";
export function FullLoadIntro(){
 const path=usePathname(),initial=useRef(path);
 useEffect(()=>{if(path!==initial.current)delete document.documentElement.dataset.intro;},[path]);
 return null;
}
