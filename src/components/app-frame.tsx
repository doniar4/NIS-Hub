"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect,useRef,useState,useSyncExternalStore,type ReactNode} from "react";
import {useI18n} from "./locale-provider";
import {v05Copy} from "@/lib/v05-copy";
import {Sprout} from "./brand";
<<<<<<< HEAD
import {BotanicalFlourish} from "./academic-art";
import {vintageCopy} from "@/lib/vintage-copy";
=======
>>>>>>> ccc1ea1b5766fdcae994fe1ed3ca7707cb081dc3
let memoryCollapsed=false;
function snapshot(){try{return localStorage.getItem("nis-sidebar")==="collapsed";}catch{return memoryCollapsed;}}
function subscribe(listener:()=>void){window.addEventListener("storage",listener);window.addEventListener("nis-sidebar-change",listener);return()=>{window.removeEventListener("storage",listener);window.removeEventListener("nis-sidebar-change",listener);};}
const paths=["M3 10l9-7 9 7v11h-6v-7H9v7H3Z","M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3ZM12 6v16","M4 5h16v16H4ZM4 10h16M8 2v6m8-6v6","M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 21v-3c0-6 16-6 16 0v3","M4 4h16v13H9l-5 4ZM8 8h8m-8 4h5","M4 4h6v6H4Zm10 0h6v6h-6ZM4 14h6v6H4Zm10 0h6v6h-6Z"];
function NavIcon({index}:{index:number}){return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={paths[index]}/></svg>;}
export function AppFrame({children,preferences,account,avatar,admin=false}:{children:ReactNode;preferences:ReactNode;account:ReactNode;avatar:ReactNode;admin?:boolean}){
 const {locale,t}=useI18n(),p=v05Copy(locale),pathname=usePathname();
 const collapsed=useSyncExternalStore(subscribe,snapshot,()=>false);
 const dialog=useRef<HTMLDialogElement>(null),menuButton=useRef<HTMLButtonElement>(null),[mobileOpen,setMobileOpen]=useState(false);
 useEffect(()=>{document.documentElement.dataset.sidebar=collapsed?"collapsed":"expanded";},[collapsed]);
 function toggle(){memoryCollapsed=!collapsed;try{localStorage.setItem("nis-sidebar",memoryCollapsed?"collapsed":"expanded");}catch{}window.dispatchEvent(new Event("nis-sidebar-change"));}
 function close(){dialog.current?.close();setMobileOpen(false);}
 const links=[["/",t.home],["/library",t.library],["/schedule",t.schedule],["/profile",t.profile],["/support",p.support],...(admin?[["/admin",t.admin]]:[])];
 const navigation=(mobile:boolean)=><nav aria-label={t.mainNav}>{links.map(([href,label],index)=><Link key={href} prefetch={false} href={href} title={!mobile&&collapsed?label:undefined}
 aria-label={label} aria-current={(href==="/"?pathname===href:pathname.startsWith(href))?"page":undefined} className="sidebar-link"
 onClick={()=>{delete document.documentElement.dataset.intro;if(mobile){close();requestAnimationFrame(()=>document.getElementById("main")?.focus());}}}>
 <NavIcon index={index}/><span className="sidebar-label">{label}</span></Link>)}</nav>;
 return <div className="app-frame"><a className="skip-link" href="#main">{t.skip}</a>
<<<<<<< HEAD
 <aside className="app-sidebar"><BotanicalFlourish className="sidebar-flourish"/><Link className="brand-link" href="/" aria-label="NIS Hub"><Sprout/><span className="sidebar-label">NIS <em>Hub</em></span></Link>
 <div className="sidebar-edition sidebar-label"><span>NIS / НИШ / НЗМ</span><span>{vintageCopy(locale).space}</span></div>
=======
 <aside className="app-sidebar"><Link className="brand-link" href="/" aria-label="NIS Hub"><Sprout/><span className="sidebar-label">NIS Hub</span></Link>
>>>>>>> ccc1ea1b5766fdcae994fe1ed3ca7707cb081dc3
 {navigation(false)}<button type="button" className="sidebar-collapse" onClick={toggle} aria-label={collapsed?p.expand:p.collapse} aria-expanded={!collapsed}><span aria-hidden="true">{collapsed?"»":"«"}</span><span className="sidebar-label">{p.collapse}</span></button>
 <div className="sidebar-bottom"><div className="sidebar-legal"><Link href="/privacy">{t.privacy}</Link><Link href="/terms">{t.terms}</Link></div><span className="sidebar-label text-xs">NIS Hub · {t.beta}</span></div></aside>
 <div className="app-content"><header className="app-topbar">
 <button ref={menuButton} type="button" className="button button-secondary mobile-menu" aria-label={p.menu} aria-controls="mobile-navigation" aria-expanded={mobileOpen} onClick={()=>{dialog.current?.showModal();setMobileOpen(true);}}>☰</button>
<<<<<<< HEAD
 <form action="/library" method="get" role="search" aria-label={p.search} className="global-search"><svg aria-hidden="true" className="search-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><label className="sr-only" htmlFor="global-search">{p.search}</label><input id="global-search" type="search" name="q" maxLength={100} placeholder={p.search}/><button type="submit" aria-label={p.searchGo}>↗</button></form>
 <div className="topbar-preferences">{preferences}</div><div className="topbar-account">{avatar}{account}</div></header>
 <main id="main" tabIndex={-1} className="app-main"><div className="page-ornaments" aria-hidden="true"><BotanicalFlourish/><BotanicalFlourish/></div><div className="page-content">{children}</div></main>
 <footer className="app-footer"><p>NIS Hub · {t.beta}</p><div><Link href="/privacy">{t.privacy}</Link><Link href="/terms">{t.terms}</Link></div></footer>
 </div>
 <dialog ref={dialog} id="mobile-navigation" className="mobile-drawer" aria-label={p.menu} onClose={()=>{setMobileOpen(false);menuButton.current?.focus();}} onClick={event=>{if(event.target===dialog.current)close();}}>
 <div><BotanicalFlourish className="drawer-flourish"/><div className="flex items-center justify-between gap-3"><Link className="brand-link" href="/" onClick={close}><Sprout/><span>NIS <em>Hub</em></span></Link><button className="button button-secondary" type="button" onClick={close} aria-label={p.close}>×</button></div>
=======
 <form action="/library" method="get" role="search" aria-label={p.search} className="global-search"><label className="sr-only" htmlFor="global-search">{p.search}</label><input id="global-search" type="search" name="q" maxLength={100} placeholder={p.search}/><button type="submit" aria-label={p.searchGo}>↗</button></form>
 <div className="topbar-preferences">{preferences}</div><div className="topbar-account">{avatar}{account}</div></header>
 <main id="main" tabIndex={-1} className="app-main">{children}</main>
 <footer className="app-footer"><p>NIS Hub · {t.beta}</p><div><Link href="/privacy">{t.privacy}</Link><Link href="/terms">{t.terms}</Link></div></footer>
 </div>
 <dialog ref={dialog} id="mobile-navigation" className="mobile-drawer" aria-label={p.menu} onClose={()=>{setMobileOpen(false);menuButton.current?.focus();}} onClick={event=>{if(event.target===dialog.current)close();}}>
 <div><div className="flex items-center justify-between gap-3"><Link className="brand-link" href="/" onClick={close}><Sprout/><span>NIS Hub</span></Link><button className="button button-secondary" type="button" onClick={close} aria-label={p.close}>×</button></div>
>>>>>>> ccc1ea1b5766fdcae994fe1ed3ca7707cb081dc3
 {navigation(true)}<div className="sidebar-legal"><Link href="/privacy" onClick={close}>{t.privacy}</Link><Link href="/terms" onClick={close}>{t.terms}</Link></div></div>
 </dialog></div>;
}
