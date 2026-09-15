import "server-only";
const bounded=(value:string|undefined,fallback:number,max:number)=>{const n=Number(value);return Number.isInteger(n)&&n>=1&&n<=max?n:fallback;};
export function aiStudyConfig(){
 const key=process.env.GEMINI_API_KEY?.trim()??"",model=process.env.GEMINI_MODEL?.trim()??"";
 return {enabled:process.env.AI_STUDY_ENABLED==="true"&&!!key&&/^gemini-[a-z0-9.-]{1,100}$/.test(model),key,model,
 dailyLimit:bounded(process.env.AI_STUDY_DAILY_LIMIT,10,10),
 maxPages:bounded(process.env.AI_STUDY_MAX_PAGES,10,10),
 maxChars:bounded(process.env.AI_STUDY_MAX_SOURCE_CHARS,30000,30000),
 timeoutMs:bounded(process.env.AI_STUDY_TIMEOUT_MS,25000,60000)};
}
