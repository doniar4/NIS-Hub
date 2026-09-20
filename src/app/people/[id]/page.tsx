import { getCatalogOptions } from "@/lib/queries";
import { SubjectBadges } from "@/components/subject-badges";
import { requireViewer } from "@/lib/auth";
import { getI18n } from "@/lib/i18n-server";
import { v053Copy } from "@/lib/v053-copy";
import { findPeople } from "@/app/actions/people";
import { SiteShell } from "@/components/site-shell";
import { CommunityNav } from "@/components/community-nav";
import { PersonActions } from "@/components/person-actions";
export default async function PersonPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;await requireViewer("/people/"+id);const {locale}=await getI18n(),p=v053Copy(locale),result=await findPeople("profile","",id);
 const {subjects}=await getCatalogOptions();
 const person="data"in result?result.data[0]:null;
 return <SiteShell><CommunityNav locale={locale}/>{person?<article className="surface-card space-y-5 public-profile"><span className="conversation-initial" aria-hidden="true">{Array.from(person.display_name)[0]}</span><h1 className="page-title">{person.display_name}</h1>{person.bio&&<p className="whitespace-pre-wrap">{person.bio}</p>}<SubjectBadges ids={person.top_subjects} subjects={subjects} locale={locale}/><PersonActions person={person}/></article>:<p role="status">{"error"in result?p[result.error]:p.unavailable}</p>}</SiteShell>;
}
