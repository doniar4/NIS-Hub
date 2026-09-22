"use client";
import {useEffect,useRef,useState} from "react";
import type {PDFDocumentProxy,RenderTask} from "pdfjs-dist/legacy/build/pdf.mjs";
import {isRenderCancellation,reportPdfError} from "@/lib/pdf-reader-errors";
import {designCopy} from "@/lib/design-copy";
import {useI18n} from "./locale-provider";

function Thumbnail({pdf,number,current,onSelect,root}:{pdf:PDFDocumentProxy;number:number;current:number;onSelect:(page:number)=>void;root:HTMLDivElement|null}) {
  const element=useRef<HTMLButtonElement>(null),host=useRef<HTMLSpanElement>(null);
  const [nearby,setNearby]=useState(false),{t}=useI18n();
  useEffect(()=>{
    if(!element.current||!root)return;
    const observer=new IntersectionObserver(([entry])=>setNearby(entry.isIntersecting),{root,rootMargin:"200px"});
    observer.observe(element.current);return ()=>observer.disconnect();
  },[root]);
  useEffect(()=>{
    if(!nearby)return;
    let cancelled=false,task:RenderTask|undefined,canvas:HTMLCanvasElement|undefined;
    const target=host.current;
    const release=()=>{if(canvas){canvas.width=0;canvas.height=0;canvas.remove();}};
    void (async()=>{
      try {
        const source=await pdf.getPage(number);if(cancelled)return;
        const base=source.getViewport({scale:1}),viewport=source.getViewport({scale:96/base.width});
        canvas=document.createElement("canvas");canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.setAttribute("aria-hidden","true");
        task=source.render({canvas,viewport});await task.promise;
        if(!cancelled)target?.replaceChildren(canvas);
      } catch(error) {if(!cancelled&&!isRenderCancellation(error))reportPdfError("render",error,number);}
      finally {if(cancelled)release();}
    })();
    return ()=>{cancelled=true;task?.cancel();target?.replaceChildren();if(!task)release();else void task.promise.catch(()=>{}).finally(release);};
  },[pdf,number,nearby]);
  return <button ref={element} type="button" className="pdf-thumbnail" aria-label={t.page+" "+number} aria-current={current===number?"page":undefined} onClick={()=>onSelect(number)}>
    <span ref={host} className="thumbnail-canvas"/><span>{number}</span>
  </button>;
}
export function PdfThumbnails({pdf,page,onSelect}:{pdf:PDFDocumentProxy;page:number;onSelect:(page:number)=>void}) {
  const [root,setRoot]=useState<HTMLDivElement|null>(null),{locale}=useI18n();
  useEffect(()=>{const current=root?.querySelector<HTMLElement>('[aria-current="page"]');if(!root||!current)return;const item=current.getBoundingClientRect(),rail=root.getBoundingClientRect();if(item.top<rail.top||item.bottom>rail.bottom)root.scrollTo({top:root.scrollTop+item.top-rail.top-root.clientTop,behavior:"instant"});},[page,root]);
  return <div ref={setRoot} className="pdf-thumbnails" role="navigation" aria-label={designCopy(locale).thumbnails}>
    {Array.from({length:pdf.numPages},(_,index)=><Thumbnail key={index} pdf={pdf} number={index+1} current={page} onSelect={onSelect} root={root}/>)}
  </div>;
}
