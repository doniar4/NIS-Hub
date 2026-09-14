"use client";
import Image from "next/image";
import {useState} from "react";
import {useI18n} from "./locale-provider";
import {v05Copy} from "@/lib/v05-copy";
export function BookCover({title,url}:{title:string;url:string|null}){
 const {locale}=useI18n(),[failed,setFailed]=useState(false);
 return url&&!failed?<Image unoptimized src={url} width={100} height={150} alt="" className="reading-cover" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:
 <div className="book-placeholder" aria-label={v05Copy(locale).noCover}><strong>{title}</strong><span aria-hidden="true">NIS Hub</span></div>;
}
