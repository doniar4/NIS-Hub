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
import { extractPdfCoverBlob } from "@/lib/pdf-cover-extractor";
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
 <EditionForm key={selected} {...props} edition={edition} variantId={selected}/>{edition&&<div className="mt-4 flex flex-wrap gap-3"><ExtractBookText key={edition.id+edition.content_revision} variantId={edition.id}/><CoverGenerator key={"cover-"+edition.id} bookId={props.id} variantId={edition.id} storagePath={edition.storage_path}/></div>}</div>;
}
function EditionForm({id,book,subjects,action,edition,variantId,variants=[]}:EditorProps&{edition?:BookVariant;variantId:string}) {
  const { locale, t } = useI18n(); const p = phase4Copy(locale); const v=v051Copy(locale);
  const [file, setFile] = useState<File | null>(null), [state, setState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();
  const [stableId] = useState(id);
  const router = useRouter();
  const prepared = useRef(!!edition);
  const [logicalStatus, setLogicalStatus] = useState(book?.publication_status ?? "draft");
  const [variantStatus, setVariantStatus] = useState(edition?.publication_status ?? "draft");
  const [replace, setReplace] = useState(false);
  const issue = file ? pdfFileIssue(file) : null;

  function handleLogicalStatusChange(next: string) {
    if (next === "draft" || next === "published" || next === "archived") {
      setLogicalStatus(next);
      if (next === "published" && variantStatus === "draft") {
        setVariantStatus("published");
      }
    }
  }

  function handleVariantStatusChange(next: string) {
    if (next === "draft" || next === "published" || next === "archived") {
      setVariantStatus(next);
      if (next === "published" && logicalStatus === "draft") {
        setLogicalStatus("published");
      }
    }
  }

  return <form onSubmit={event => {
    event.preventDefault(); if (pending) return;
    const form = new FormData(event.currentTarget); form.delete("pdf");
    startTransition(async () => {
      setState({});
      try {
        if (file) {
          const invalid = await validatePdfFile(file);
          if (invalid) { setState({ error: p[invalid] }); return; }
          if (prepared.current && !replace && form.get("replace") !== "on") form.set("replace", "on");
          form.set("upload","yes"); form.set("file_name",file.name); form.set("file_type",file.type); form.set("file_size",String(file.size));

          // Generate first-page cover thumbnail (~25KB) directly from memory
          const coverBlob = await extractPdfCoverBlob(file);
          if (coverBlob) {
            await createClient().storage.from("book-covers").upload(`books/${variantId}.jpg`, coverBlob, {
              contentType: "image/jpeg",
              cacheControl: "3600",
              upsert: true,
            });
            form.set("cover_path", `books/${variantId}.jpg`);
          }

          // Finish sees the draft created during prepare, so explicit consent is
          // forwarded for that same operation, not inferred for future attempts.
          const prepare = await action(form, "prepare");
          if (prepare.error) { setState(prepare); return; }
          prepared.current = true;
          const result = await createClient().storage.from("book-files").upload(canonicalBookPath(variantId),
            new Blob([file], { type: "application/pdf" }), { contentType: "application/pdf", cacheControl: "0", upsert: true });
          if (result.error) { setState({ error: p.uploadError }); return; }
          form.set("replace", "on");
        }
        const result = await action(form, "finish"); setState(result);
        if (result.success) router.replace("/admin/content?id="+stableId);
      } catch { setState({ error: file ? p.uploadError : p.bookError }); }
    });
  }} className="space-y-5">
    <fieldset disabled={pending} className="space-y-5">
      <input type="hidden" name="id" value={stableId}/><input type="hidden" name="variant_id" value={variantId}/>
      <p className="text-sm text-[var(--muted)]">{p.limits}</p>
      <Field label={p.bookTitle} name="title" required maxLength={200} defaultValue={book?.title ?? ""}/>
      <label className="block"><span className="field-label">{locale === "kk" ? "Сипаттама" : locale === "en" ? "Description" : "Описание"}</span><textarea className="field min-h-28" name="description" maxLength={1000} defaultValue={book?.description ?? ""}/></label>
      <Field label={locale === "kk" ? "Тегтер (үтір арқылы)" : locale === "en" ? "Tags (comma-separated)" : "Теги (через запятую)"} name="tags" maxLength={500} defaultValue={book?.tags?.join(", ") ?? ""}/>
      <SelectField label={t.subject} name="subject_id" required options={subjects.map(s => ({ id: s.id, name: subjectName(s,locale) }))} defaultValue={book?.subject_id ?? ""}/>
      <SelectField label={v.grade} name="grade" required options={BOOK_GRADES.map(grade=>({id:String(grade),name:String(grade)}))} defaultValue={book?.grade?String(book.grade):""}/>
      <SelectField label={locale === "kk" ? "Тоқсан" : locale === "en" ? "Quarter" : "Четверть"} name="quarter" options={[1,2,3,4].map(value=>({id:String(value),name:String(value)}))} defaultValue={book?.quarter ? String(book.quarter) : ""}/>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={p.author} name="author" maxLength={200} defaultValue={book?.author ?? ""}/>
        <Field label={p.publisher} name="publisher" maxLength={200} defaultValue={book?.publisher ?? ""}/>
        <Field label={p.year} name="publication_year" type="number" min={1000} max={9999} defaultValue={book?.publication_year ?? ""}/>
        <label><span className="field-label">{v.edition}</span><select className="field" name="language" defaultValue={edition?.language??EDITION_LANGUAGES.find(language=>!variants.some(item=>item.language===language))??"ru"}>{EDITION_LANGUAGES.map(language=><option value={language} key={language} disabled={variants.some(item=>item.id!==variantId&&item.language===language)}>{v[language]}</option>)}</select></label>
      </div>
      <Field label={p.pages} name="page_count" type="number" min={1} max={100000} defaultValue={edition?.page_count ?? ""}/>
      <label className="block"><span className="field-label">{v.logicalStatus}</span><select className="field" name="publication_status" value={logicalStatus} onChange={e=>handleLogicalStatusChange(e.target.value)}>
        <option value="draft">{p.draft}</option><option value="published">{p.published}</option><option value="archived">{p.archived}</option>
      </select></label>
      <label className="block"><span className="field-label">{v.editionStatus}</span><select className="field" name="variant_status" value={variantStatus} onChange={e=>handleVariantStatusChange(e.target.value)}><option value="draft">{p.draft}</option><option value="published">{p.published}</option><option value="archived">{p.archived}</option></select></label>
      <Field label={p.pdf} name="pdf" type="file" accept=".pdf,application/pdf" onChange={event => { const chosen = event.target.files?.[0] ?? null; setFile(chosen); setState({}); if(chosen && prepared.current) setReplace(true); }}/>
      {file && <p role="status">{file.name} · {(file.size / 1048576).toFixed(2)} MiB ({file.size.toLocaleString(locale)} bytes)</p>}
      {issue && <p role="alert">{p[issue]}</p>}
      {edition?.storage_path && (
        <div className="p-3 my-2 rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            {locale === "kk" ? "Кітап мұқабасы" : locale === "en" ? "Book cover" : "Обложка книги"}
          </span>
          <p className="text-xs text-[var(--muted)]">
            {locale === "kk"
              ? "Егер кітап мұқабасы болмаса, оны жүктелген PDF-тің 1-бетінен жасаңыз:"
              : locale === "en"
              ? "If the book cover is missing, generate it from page 1 of the uploaded PDF:"
              : "Если обложка книги отсутствует, создайте её из 1-й страницы загруженного PDF:"}
          </p>
          <CoverGenerator bookId={stableId} variantId={variantId} storagePath={edition.storage_path}/>
        </div>
      )}
      <p className="text-sm text-[var(--muted)]">{p.metadataHint}</p>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="replace" className="mt-1" checked={replace} onChange={e=>setReplace(e.target.checked)}/>{p.replace}</label>
      <button type="submit" className="button" disabled={!!issue}>{pending ? p.uploading : p.save}</button>
    </fieldset>
    {state.error && <p role="alert">{state.error}</p>}{state.success && <p role="status">{state.success}</p>}
    {pending && <p role="status">{p.uploading}</p>}
  </form>;
}

function CoverGenerator({bookId,variantId,storagePath}:{bookId:string;variantId:string;storagePath?:string|null}){
  const {locale}=useI18n();
  const [running,setRunning]=useState(false);
  const [msg,setMsg]=useState("");
  const router=useRouter();

  const generate=async()=>{
    if(!storagePath)return;
    setRunning(true);
    setMsg("");
    try{
      const supabase=createClient();
      const {data,error}=await supabase.storage.from("book-files").download(storagePath);
      if(error||!data){
        setMsg(locale==="kk"?"Файлды жүктеу мүмкін болмады":locale==="en"?"Download failed":"Не удалось загрузить PDF");
        return;
      }
      const coverBlob=await extractPdfCoverBlob(data);
      if(!coverBlob){
        setMsg(locale==="kk"?"Мұқабаны шығару сәтсіз аяқталды":locale==="en"?"Cover extraction failed":"Не удалось создать обложку");
        return;
      }
      const path=`books/${variantId}.jpg`;
      await supabase.storage.from("book-covers").upload(path,coverBlob,{
        contentType:"image/jpeg",
        cacheControl:"3600",
        upsert:true,
      });
      await supabase.from("book_variants").update({cover_path:path}).eq("id",variantId);
      await supabase.from("books").update({cover_path:path}).eq("id",bookId);
      setMsg(locale==="kk"?"Обложка сақталды!":locale==="en"?"Cover saved!":"Обложка обновлена!");
      router.refresh();
    }catch{
      if(process.env.NODE_ENV==="development")console.error("[CoverGenerator] operation failed");
      setMsg(locale==="kk"?"Қате орын алды":locale==="en"?"Error occurred":"Произошла ошибка");
    }finally{
      setRunning(false);
    }
  };

  if(!storagePath)return null;
  return <div className="inline-flex items-center gap-2">
    <button type="button" className="button button-secondary" disabled={running} onClick={()=>void generate()}>
      {running?(locale==="kk"?"Жасалуда…":locale==="en"?"Generating…":"Создание обложки…"):(locale==="kk"?"1-беттен мұқаба жасау":locale==="en"?"Generate cover from page 1":"Создать обложку из 1-й стр.")}
    </button>
    {msg&&<span className="text-sm font-medium text-[var(--muted)]">{msg}</span>}
  </div>;
}
