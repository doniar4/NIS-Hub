import "server-only";
import {getSupabaseConfig} from "./env";
import {readTelegramConfig} from "./telegram/security";
import {aiStudyConfig} from "./ai-study-config";
import {eduPageEnabled} from "./edupage/config";
import packageInfo from "../../package.json";
export function adminSystemConfig(){
 let database=false;try{database=!!getSupabaseConfig();}catch{database=false;}
 const sha=process.env.VERCEL_GIT_COMMIT_SHA??process.env.NIS_BUILD_COMMIT??"";
 const built=process.env.NIS_BUILD_TIMESTAMP??"";
 // Whitelisted status and validated build metadata ONLY. Never spread provider
 // config objects (they contain keys); never return raw provider exceptions.
 return {services:[{name:"Supabase",configured:database},{name:"Auth",configured:database},{name:"Telegram Homework",configured:!!readTelegramConfig()},{name:"AI Study",configured:aiStudyConfig().enabled},{name:"EduPage",configured:eduPageEnabled()}],version:packageInfo.version,
  commit:/^[a-f0-9]{7,40}$/i.test(sha)?sha:null,
  built:/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(built)&&Number.isFinite(new Date(built).getTime())?built:null};
}
