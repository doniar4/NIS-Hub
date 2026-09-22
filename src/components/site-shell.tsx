import {getI18n} from "@/lib/i18n-server";
import Link from "next/link";
import {PreferenceControls} from "./preference-controls";
import {changeLocale} from "@/app/actions/preferences";
import type {ReactNode} from "react";
import {getViewer} from "@/lib/auth";
import {database} from "@/lib/queries";
import {AVATAR_URL_TTL_SECONDS} from "@/lib/avatar-policy";
import {ActionForm} from "./action-form";
import {logout} from "@/app/actions/auth";
import {AppFrame} from "./app-frame";
import {NotificationCenter} from "./notification-center";
import {HeaderAvatar} from "./header-avatar";
export async function SiteShell({children}:{children:ReactNode}){
 const {t}=await getI18n(),viewer=await getViewer();let url:string|null=null;
 if(viewer.user&&viewer.profile?.avatar_path===viewer.user.id+"/avatar.webp"){
  const db=await database();const result=await db.storage.from("avatars").createSignedUrl(viewer.profile.avatar_path,AVATAR_URL_TTL_SECONDS);url=result.data?.signedUrl??null;
 }
 return <AppFrame admin={viewer.profile?.role==="admin"} preferences={<PreferenceControls localeAction={changeLocale}/>}
 profileAccount={viewer.user?<><HeaderAvatar key={url} url={url} name={viewer.profile?.display_name??""}/><span>{viewer.profile?.display_name||t.profile}</span></>:null}
 account={viewer.user?<ActionForm action={logout} label={t.logout} className="text-sm"/>:<Link className="button button-small" href="/login">{t.login}</Link>}
 avatar={viewer.user?<><NotificationCenter key={viewer.user.id}/><HeaderAvatar key={url} url={url} name={viewer.profile?.display_name??""}/></>:null}>{children}</AppFrame>;
}
