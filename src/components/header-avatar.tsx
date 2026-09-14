"use client";
import Image from "next/image";
import Link from "next/link";
import {useState} from "react";
import {useI18n} from "./locale-provider";
export function HeaderAvatar({url,name}:{url:string|null;name:string}){
 const {t}=useI18n(),[failed,setFailed]=useState(false);
 return <Link href="/profile" prefetch={false} aria-label={t.profile} className="header-avatar">{url&&!failed?<Image unoptimized src={url} width={40} height={40} alt="" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:<span aria-hidden="true">{name.trim().slice(0,1).toLocaleUpperCase()||"N"}</span>}</Link>;
}
