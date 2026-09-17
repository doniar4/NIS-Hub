"use client";
import {ExtractBookText} from "./extract-book-text";
import {BOOK_GRADES,EDITION_LANGUAGES} from "@/lib/book-model";
import {v051Copy} from "@/lib/v051-copy";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useI18n } from "./locale-provider";
import { Field, SelectField } from "./fields";
import { phase4Copy } from "@/lib/phase4-copy";
import { createClient } from "@/lib/supabase/client";
import { canonicalBookPath, pdfFileIssue, validatePdfFile } from "@/lib/book-upload";
import type { Book, BookVariant, ClassRow, SubjectRow } from "@/lib/database.types";
import { subjectName } from "@/lib/i18n";
import type { ActionState } from "@/lib/action-state";

type EditorProps={id:string;book?:Book;classes:ClassRow[];subjects:SubjectRow[];variants?:BookVariant[];action:(form:FormData,stage:"prepare"|"finish")=>Promise<ActionState>};
export function BookEditor(props:EditorProps){
 const {locale}=useI18n(),p=v051Copy(locale);
 const [selected,setSelected]=useState(props.variants?.[0]?.id??props.id);
 const [newId,setNewId]=useState<string|null>(null);
 const variants=props.variants??[],edition=variants.find(v=>v.id===selected);
 return <div>{variants.length>0&&<div className="mb-6 flex flex-wrap items-end gap-3"><label><span className="field-label">{p.edition}</span><select className="field" value={selected} onChange={e=>setSelected(e.target.value)}>{variants.map(v=><option key={v.id} value={v.id}>{p[v.language]}</option>)}{newId&&<option value={newId}>{p.newEdition}</option>}</select></label><button className="button button-secondary" disabled={variants.length>=EDITION_LANGUAGES.length} onClick={()=>{const next=newId??crypto.randomUUID();setNewId(next);setSelected(next);}}>{p.newEdition}</button></div>}
 <EditionForm key={selected} {...props} edition={edition} variantId={selected}/>{edition&&<ExtractBookText key={edition.id+edition.content_revision} variantId={edition.id}/>}</div>;
}
function EditionForm({id,book,subjects,action,edition,variantId,variants=[]}:EditorProps&{edition?:BookVariant;variantId:string}) {
  const { locale, t } = useI18n(); const p = phase4Copy(locale); const v=v051Copy(locale);
  const [file, setFile] = useState<File | null>(null), [state, setState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();
  const [stableId] = useState(id);
  const router = useRouter();
  const prepared = useRef(!!edition);
  const issue = file ? pdfFileIssue(file) : null;
  return <form onSubmit={event => {
    event.preventDefault(); if (pending) return;
    const form = new FormData(event.currentTarget); form.delete("pdf");
    startTransition(async () => {
      setState({});
      try {
        if (file) {
          const invalid = await validatePdfFile(file);
          if (invalid) { setState({ error: p[invalid] }); return; }
          if (prepared.current && form.get("replace") !== "on") { setState({ error: p.bookInvalid }); return; }
          form.set("upload","yes"); form.set("file_name",file.name); form.set("file_type",file.type); form.set("file_size",String(file.size));
          // Finish sees the draft created during prepare, so explicit consent is
          // forwarded for that same operation, not inferred for future attempts.
          const prepare = await action(form, "prepare");
          if (prepare.error) { setState(prepare); return; }
          prepared.current = true;
          const result = await createClient().storage.from("book-files").upload(canonicalBookPath(variantId),
            new Blob([file], { type: "application/pdf" }), { contentType: "application/pdf", cacheControl: "0", upsert: form.get("replace") === "on" });
          if (result.error) { setState({ error: p.uploadError }); return; }
          form.set("replace", "on");
        }
        const result = await action(form, "finish"); setState(result);
        if (result.success) router.replace("/admin?entity=books&id="+stableId);
      } catch { setState({ error: file ? p.uploadError : p.bookError }); }
    });
  }} className="space-y-5">
    <fieldset disabled={pending} className="space-y-5">
      <input type="hidden" name="id" value={stableId}/><input type="hidden" name="variant_id" value={variantId}/>
      <p className="text-sm text-[var(--muted)]">{p.limits}</p>
      <Field label={p.bookTitle} name="title" required maxLength={200} defaultValue={book?.title ?? ""}/>
      <SelectField label={t.subject} name="subject_id" required options={subjects.map(s => ({ id: s.id, name: subjectName(s,locale) }))} defaultValue={book?.subject_id ?? ""}/>
      <SelectField label={v.grade} name="grade" required options={BOOK_GRADES.map(grade=>({id:String(grade),name:String(grade)}))} defaultValue={book?.grade?String(book.grade):""}/>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={p.author} name="author" maxLength={200} defaultValue={book?.author ?? ""}/>
        <Field label={p.publisher} name="publisher" maxLength={200} defaultValue={book?.publisher ?? ""}/>
        <Field label={p.year} name="publication_year" type="number" min={1000} max={9999} defaultValue={book?.publication_year ?? ""}/>
        <label><span className="field-label">{v.edition}</span><select className="field" name="language" defaultValue={edition?.language??EDITION_LANGUAGES.find(language=>!variants.some(item=>item.language===language))??"ru"}>{EDITION_LANGUAGES.map(language=><option value={language} key={language} disabled={variants.some(item=>item.id!==variantId&&item.language===language)}>{v[language]}</option>)}</select></label>
      </div>
      <Field label={p.pages} name="page_count" type="number" min={1} max={100000} defaultValue={edition?.page_count ?? ""}/>
      <label className="block"><span className="field-label">{v.logicalStatus}</span><select className="field" name="publication_status" defaultValue={book?.publication_status ?? "draft"}>
        <option value="draft">{p.draft}</option><option value="published">{p.published}</option><option value="archived">{p.archived}</option>
      </select></label>
      <label className="block"><span className="field-label">{v.editionStatus}</span><select className="field" name="variant_status" defaultValue={edition?.publication_status??"draft"}><option value="draft">{p.draft}</option><option value="published">{p.published}</option><option value="archived">{p.archived}</option></select></label>
      <Field label={p.pdf} name="pdf" type="file" accept=".pdf,application/pdf" onChange={event => { setFile(event.target.files?.[0] ?? null); setState({}); }}/>
      {file && <p role="status">{file.name} · {(file.size / 1048576).toFixed(2)} MiB ({file.size.toLocaleString(locale)} bytes)</p>}
      {issue && <p role="alert">{p[issue]}</p>}
      <p className="text-sm text-[var(--muted)]">{p.metadataHint}</p>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="replace" className="mt-1"/>{p.replace}</label>
      <button type="submit" className="button" disabled={!!issue}>{pending ? p.uploading : p.save}</button>
    </fieldset>
    {state.error && <p role="alert">{state.error}</p>}{state.success && <p role="status">{state.success}</p>}
    {pending && <p role="status">{p.uploading}</p>}
  </form>;
}
