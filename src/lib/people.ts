export type Person = {id:string;display_name:string;bio:string|null;top_subjects:string[];relationship:"self"|"none"|"friend"|"outgoing"|"incoming"|"blocked"};
export type PeopleScope = "search"|"profile"|"friends"|"requests"|"blocked";
export type CommunityError = "failed"|"migration"|"rate"|"unavailable";
export function communityError(error:{code?:string;message?:string}):{error:CommunityError}{
 if (["42P01","42883","PGRST202","PGRST205"].includes(error.code??""))return {error:"migration"};
 if(error.message?.includes("rate_limit"))return {error:"rate"};
 if(error.message?.includes("unavailable"))return {error:"unavailable"};
 return {error:"failed"};
}
export function messagePreview(body:string){const chars=Array.from(body.replace(/\s+/gu," ").trim());return chars.length>120?chars.slice(0,119).join("")+"…":chars.join("");}
