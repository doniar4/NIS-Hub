"use client";
import {useEffect,useRef,useState,useSyncExternalStore,type ReactNode} from "react";
import {useI18n} from "./locale-provider";
import {designCopy} from "@/lib/design-copy";

const subscribeDesktop=(listener:()=>void)=>{const media=window.matchMedia("(min-width: 1280px)");media.addEventListener("change",listener);return ()=>media.removeEventListener("change",listener);};
const desktopSnapshot=()=>window.matchMedia("(min-width: 1280px)").matches;
const subscribeHash=(listener:()=>void)=>{window.addEventListener("hashchange",listener);return ()=>window.removeEventListener("hashchange",listener);};
const hashSnapshot=()=>window.location.hash==="#ai-study";

export function ReaderWorkspace({children,inspector,information}:{children:ReactNode;inspector:ReactNode;information:ReactNode}) {
  const {locale}=useI18n(),c=designCopy(locale);
  const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
  const desktop=useSyncExternalStore(subscribeDesktop,desktopSnapshot,()=>false);
  const studyIntent=useSyncExternalStore(subscribeHash,hashSnapshot,()=>false);
  const [requestedOpen,setOpen]=useState<boolean|null>(null);
  const open=requestedOpen??(desktop||studyIntent);
  useEffect(()=>{const hash=()=>{if(window.location.hash==="#ai-study")setOpen(true);};window.addEventListener("hashchange",hash);return ()=>window.removeEventListener("hashchange",hash);},[]);
  useEffect(()=>{
    const element=dialog.current;if(!element)return;
    const focused=document.activeElement as HTMLElement|null;
    // One persistent DOM subtree: collapsing/resizing never loses a selected range or answer.
    if(element.open)element.close();
    if(!open)return;
    if(desktop){element.show();focused?.focus({preventScroll:true});}
    else element.showModal();
    const previous=document.body.style.overflow;
    if(!desktop)document.body.style.overflow="hidden";
    return ()=>{if(element.open)element.close();if(!desktop)document.body.style.overflow=previous;};
  },[open,desktop]);
  const close=()=>{dialog.current?.close();setOpen(false);trigger.current?.focus({preventScroll:true});};
  return <section className="reader-workspace" data-inspector-open={open&&desktop}>
    <div className="reader-workspace-heading"><details className="book-information"><summary>{c.details}</summary>{information}</details>
      <button ref={trigger} className="button button-secondary" aria-expanded={open} aria-controls="ai-study" onClick={()=>setOpen(!open)}>{c.openStudy} <span aria-hidden="true">✦</span></button>
    </div>
    <div className="reader-main">{children}</div>
    <dialog ref={dialog} id="ai-study" className="reader-inspector" aria-label="AI Study" onCancel={event=>{event.preventDefault();close();}}
      onClick={event=>{if(event.target!==event.currentTarget)return;const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();}}>
      <header className="inspector-heading"><h2>AI Study <span className="status-chip">beta</span></h2><button className="icon-button" aria-label={c.close} onClick={close}>×</button></header>
      {inspector}
    </dialog>
  </section>;
}
