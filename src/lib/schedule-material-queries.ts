import "server-only";
import { database,getLibraryBooks } from "./queries";
import { requireViewer } from "./auth";
import { materialDestinations,type MaterialEdition } from "./schedule-materials";
export async function getTimetableMaterials(subjects:string[],grades:(number|null)[]){
 if(!subjects.length)return {};
 const {user}=await requireViewer("/schedule"),db=await database(),catalog=await getLibraryBooks();
 const relevant=catalog.books.filter(b=>subjects.includes(b.subject_id));
 const editions:MaterialEdition[]=[];
 // Four edition languages per logical book; 200-book batches remain below API row caps.
 for(let i=0;i<relevant.length;i+=200){
 const {data,error}=await db.from("book_variants").select("id,book_id").eq("publication_status","published").in("book_id",relevant.slice(i,i+200).map(b=>b.id)).limit(800);
 if(error)throw new Error("Could not resolve schedule materials");editions.push(...data);
 }
 const progress=await db.from("variant_reading_progress").select("book_variant_id").eq("profile_id",user.id).order("updated_at",{ascending:false}).limit(100);
 if(progress.error)throw new Error("Could not resolve reading preferences");
 return materialDestinations(relevant,editions,progress.data.map(p=>p.book_variant_id),subjects,grades,catalog.truncated);
}
