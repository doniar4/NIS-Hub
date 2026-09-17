import {createClient} from "@/lib/supabase/server";
import {canReadBook,pdfPathSchema,uuid} from "@/lib/validation";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const headers={"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"};
 const {id}=await params,requested=new URL(request.url).searchParams.get("variant");
 if(!uuid.safeParse(id).success||(requested&&!uuid.safeParse(requested).success))return Response.json({error:"Material unavailable"},{status:404,headers});
 const supabase=await createClient(true);
 if(!supabase)return Response.json({error:"Service unavailable"},{status:503,headers});
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user)return Response.json({error:"Sign in required"},{status:401,headers});
 const {data:book,error}=await supabase.from("books").select("publication_status").eq("id",id).maybeSingle();
 if(error)return Response.json({error:"Access check failed"},{status:503,headers});
 if(!book||!canReadBook(book))return Response.json({error:"Material unavailable"},{status:404,headers});
 let query=supabase.from("book_variants").select("id,storage_path").eq("book_id",id).eq("publication_status","published").order("created_at").order("id").limit(4);
 if(requested)query=query.eq("id",requested);
 const editions=await query;
 if(editions.error)return Response.json({error:"Access check failed"},{status:503,headers});
 const edition=requested?editions.data[0]:editions.data.find(v=>v.id===id)??editions.data[0];
 if(!edition||!pdfPathSchema.safeParse(edition.storage_path).success)return Response.json({error:"Material unavailable"},{status:404,headers});
 const {data,error:storageError}=await supabase.storage.from("book-files").createSignedUrl(edition.storage_path,60);
 if(storageError||!data)return Response.json({error:"File unavailable"},{status:503,headers});
 return Response.json({url:data.signedUrl,expiresIn:60},{headers});
}
