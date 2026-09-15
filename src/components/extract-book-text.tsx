"use client";
import {useEffect,useRef,useState} from "react";
import {z} from "zod";
import type {PDFDocumentLoadingTask} from "pdfjs-dist/legacy/build/pdf.mjs";
import {createClient} from "@/lib/supabase/client";
import {extractPageText} from "@/lib/pdf-page-text";
import {useI18n} from "./locale-provider";
import {v051Copy} from "@/lib/v051-copy";
const jobSchema=z.object({ready:z.boolean(),job:z.uuid().optional(),revision:z.uuid().optional(),path:z.string().optional()});
export function ExtractBookText({variantId}:{variantId:string}){
 const {locale}=useI18n(),p=v051Copy(locale);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 const cancel=useRef<AbortController|null>(null);
 useEffect(()=>()=>cancel.current?.abort(),[]);
 async function run(){
  const abort=new AbortController();cancel.current=abort;setBusy(true);setError("");setMessage("");
  const db=createClient();let task:PDFDocumentLoadingTask|undefined;let job:ReturnType<typeof jobSchema.parse>|undefined;
  try{
   const start=await db.rpc("begin_book_extraction",{p_variant:variantId});
   if(start.error)throw new Error("Extraction unavailable");
   job=jobSchema.parse(start.data);
   if(job.ready){setMessage(p.extractReady);return;}
   if(!job.job||!job.revision||!job.path)throw new Error("Invalid extraction");
   const file=await db.storage.from("book-files").download(job.path);
   if(file.error||!file.data||file.data.size>52428800||abort.signal.aborted)throw new Error("File unavailable");
   const bytes=await file.data.arrayBuffer();
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),b=>b.toString(16).padStart(2,"0")).join("");
   const pdfjs=await import("pdfjs-dist/legacy/build/pdf.mjs");
   pdfjs.GlobalWorkerOptions.workerSrc=new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs",import.meta.url).toString();
   task=pdfjs.getDocument({data:bytes,useSystemFonts:true,cMapUrl:"/pdfjs/cmaps/",standardFontDataUrl:"/pdfjs/standard_fonts/",wasmUrl:"/pdfjs/wasm/",iccUrl:"/pdfjs/iccs/"});
   const pdf=await task.promise;
   if(pdf.numPages>1000)throw new Error("Page limit");
   let total=0;
   for(let first=1;first<=pdf.numPages;first+=5){
    const pages:{page:number;text:string}[]=[];
    for(let page=first;page<=Math.min(first+4,pdf.numPages);page++){
     if(abort.signal.aborted)throw new Error("Cancelled");
     const current=await pdf.getPage(page),text=await extractPageText(current,abort.signal);
     total+=text.length;
     if(text.length>100000||total>10000000)throw new Error("Text limit");
     pages.push({page,text});current.cleanup();
    }
    const batch=await db.rpc("put_book_pages",{p_variant:variantId,p_revision:job.revision,p_job:job.job,p_pages:pages});
    if(batch.error)throw new Error("Source changed or batch failed");
    if(!abort.signal.aborted)setMessage(Math.min(first+4,pdf.numPages)+" / "+pdf.numPages);
   }
   if(abort.signal.aborted)throw new Error("Cancelled");
   const end=await db.rpc("finish_book_extraction",{p_variant:variantId,p_revision:job.revision,p_job:job.job,p_count:pdf.numPages,p_hash:hash,p_failed:false});
   if(end.error)throw new Error("Could not finish extraction");
   setMessage(p.extractReady);
  }catch{
   if(job?.job&&job.revision)await db.rpc("finish_book_extraction",{p_variant:variantId,p_revision:job.revision,p_job:job.job,p_count:0,p_hash:"",p_failed:true});
   if(!abort.signal.aborted)setError(p.unavailable);
  }finally{if(task)await task.destroy().catch(()=>{if(!abort.signal.aborted)setError(p.unavailable);});if(!abort.signal.aborted)setBusy(false);}
 }
 return <section className="mt-6 border-t border-[var(--line)] pt-5"><p className="mb-3 text-sm text-[var(--muted)]">{p.extractHint}</p><button className="button button-secondary" disabled={busy} onClick={()=>void run()}>{busy?p.working:p.extract}</button><p role="status">{message}</p>{error&&<p role="alert">{error}</p>}</section>;
}
