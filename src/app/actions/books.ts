"use server";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {actionContext} from "@/lib/auth";
import {getI18n} from "@/lib/i18n-server";
import {phase4Copy} from "@/lib/phase4-copy";
import {bookSchema,uuid} from "@/lib/validation";
import {BOOK_PDF_BYTES,canonicalBookPath,pdfFileIssue} from "@/lib/book-upload";
import type {ActionState} from "@/lib/action-state";
const editionSchema=bookSchema.omit({class_id:true,language:true}).extend({grade:z.coerce.number().int().min(7).max(12),language:z.enum(["ru","kz","en","und"]),variant_status:z.enum(["draft","published","archived"])});
export async function saveBook(form:FormData,stage:"prepare"|"finish"):Promise<ActionState>{
 const {locale}=await getI18n(),t=phase4Copy(locale);
 try{
  const {supabase}=await actionContext(true);
  const id=uuid.safeParse(form.get("id")),vid=uuid.safeParse(form.get("variant_id"));
  if(!id.success||!vid.success||!["prepare","finish"].includes(stage))return {error:t.bookInvalid};
  const {data:current,error:readError}=await supabase.from("book_variants").select("*").eq("id",vid.data).maybeSingle();
  if(readError)return {error:t.bookError};
  if(current&&current.book_id!==id.data)return {error:t.bookInvalid};
  const uploading=form.get("upload")==="yes";
  if(!current&&!uploading)return {error:t.pdfInvalid};
  const path=uploading?canonicalBookPath(vid.data):current!.storage_path;
  const parsed=editionSchema.safeParse({...Object.fromEntries(form),file_path:path});
  if(!parsed.success)return {error:t.bookInvalid};
  let size=current?.file_size??null;
  if(uploading){
   const file={name:String(form.get("file_name")??""),type:String(form.get("file_type")??""),size:Number(form.get("file_size"))};
   const issue=pdfFileIssue(file);if(issue)return {error:t[issue]};
   if(current&&form.get("replace")!=="on")return {error:t.bookInvalid};
   size=file.size;
  }
  if(stage==="prepare"&&!uploading)return {error:t.bookInvalid};
  if(stage==="finish"&&(parsed.data.variant_status==="published"||uploading)){
   const {data,error}=await supabase.storage.from("book-files").info(path);
   if(error||!data||typeof data.size!=="number"||data.size<5||data.size>BOOK_PDF_BYTES||data.contentType?.split(";")[0]!=="application/pdf")return {error:t.fileMissing};
   size=data.size;
  }
  const book=parsed.data;
  const {error}=await supabase.rpc("save_book_edition",{p_book:book,p_variant:{id:vid.data,language:book.language,storage_path:path,page_count:book.page_count,file_size:size,publication_status:book.variant_status},p_prepare:stage==="prepare"});
  if(error)return {error:t.bookError};
 }catch{return {error:t.bookError};}
 if(stage==="finish")revalidatePath("/","layout");
 return {success:t.bookSaved};
}
