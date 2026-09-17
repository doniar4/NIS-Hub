import type {Locale} from "@/lib/i18n";
import {v05Copy} from "@/lib/v05-copy";
import {Field} from "./fields";
export function TicketFields({locale}:{locale:Locale}){
 const t=v05Copy(locale);
 return <><p>{t.ticketsHint}</p>
 <label className="block"><span className="field-label">{t.category}</span><select name="category" className="field">{Object.entries(t.categories).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
 <Field label={t.title} name="title" maxLength={120} required/>
 <label className="block"><span className="field-label">{t.description}</span><textarea className="field" name="description" maxLength={5000} rows={6} required/></label></>;
}
