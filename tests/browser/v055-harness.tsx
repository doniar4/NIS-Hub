// Isolated UI QA only. All SMS responses below are synthetic; never production data.
import {createRoot} from "react-dom/client";
import {useState} from "react";
import {AppFrame} from "../../src/components/app-frame";
import {LocaleProvider} from "../../src/components/locale-provider";
import {PreferenceControls} from "../../src/components/preference-controls";
import {SmsDiary} from "../../src/components/sms-diary";
import {LibraryBrowser} from "../../src/components/library-browser";
import {LegalContent} from "../../src/components/legal-content";
import {parseLocale} from "../../src/lib/i18n";
import {HIDDEN_BOOK_TITLE,initialLibraryFilters} from "../../src/lib/library";
function Harness(){
 const params=new URLSearchParams(location.search);
 const [locale,setLocale]=useState(parseLocale(params.get("locale")||"en"));
 return <LocaleProvider locale={locale}><AppFrame preferences={<PreferenceControls localeAction={async value=>{setLocale(parseLocale(value));return {ok:true};}}/>} account={null} avatar={null}>
 <h1>SMS Diary QA</h1>
 {location.pathname==="/library"?<LibraryBrowser books={[{id:"normal",title:"Physics",grade:9,subject_id:"physics"},{id:"egg",title:HIDDEN_BOOK_TITLE,grade:11,subject_id:"literature"}]} classes={[]} subjects={[]} initial={initialLibraryFilters(Object.fromEntries(params))} truncated={false}/>:
 location.pathname==="/privacy"?<LegalContent kind="privacy" locale={locale}/>:
 <SmsDiary enabled={params.get("mode")!=="disabled"} sessionPresent={params.get("connected")==="1"}/>}
 </AppFrame></LocaleProvider>;
}
createRoot(document.getElementById("root")!).render(<Harness/>);
