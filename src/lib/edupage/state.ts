import "server-only";
import {requireAdmin} from "../auth";
import {database} from "../queries";
import {eduPageEnabled} from "./config";
import {validateAliases,type EduPageAliases} from "./mapping";
export type EduPageStatus = {enabled:boolean;ready:boolean;lastChecked:string|null;lastSynced:string|null;
  activeVersion:string|null;error:string|null;aliases:EduPageAliases};
export async function getEduPageStatus():Promise<EduPageStatus>{
  await requireAdmin();
  const db=await database();
  const [state,version]=await Promise.all([
    db.from("edupage_sync_state").select("*").eq("id",true).maybeSingle(),
    db.from("schedule_import_batches").select("id").eq("status","active").single()
  ]);
  const result:EduPageStatus={enabled:eduPageEnabled(),ready:!state.error&&!version.error,
    lastChecked:state.data?.last_checked??null,lastSynced:state.data?.last_synced??null,
    activeVersion:version.data?.id??null,error:state.data?.last_error??null,aliases:{classes:{},subjects:{}}};
  if(state.data)try{result.aliases=validateAliases(state.data.aliases);}catch{result.error="mapping";}
  return result;
}
