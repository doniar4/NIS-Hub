/**
 * Development-only diagnostics with a closed payload. Never log provider/DB
 * messages, exceptions, source text, IDs, URLs or any environment values.
 */
const stages=["disabled","invalid-input","range-too-large","edition-unavailable","book-unavailable","extraction-unavailable","pages-unavailable","source-size-invalid","reservation-error","reservation-state","missing-generation","cache-invalid","save-generation-failed","provider-error","unexpected-error"] as const;
const codes=["disabled","unavailable","busy","quota","provider_quota","configuration","timeout","failed"] as const;
const providerStages=["configuration","request","http","read-response","parse-response","validate-response"] as const;
export function studyDebug(stage:string,details:Record<string,unknown>={}){
 if(process.env.NODE_ENV!=="development")return;
 const safe:Record<string,string|number>={stage:(stages as readonly string[]).includes(stage)?stage:"unexpected-error"};
 if(typeof details.code==="string"&&(codes as readonly string[]).includes(details.code))safe.code=details.code;
 if(typeof details.providerStage==="string"&&(providerStages as readonly string[]).includes(details.providerStage))safe.providerStage=details.providerStage;
 if(typeof details.httpStatus==="number"&&Number.isInteger(details.httpStatus)&&details.httpStatus>=100&&details.httpStatus<=599)safe.httpStatus=details.httpStatus;
 console.error("[AI Study]",safe);
}
