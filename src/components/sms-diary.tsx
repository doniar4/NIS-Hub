"use client";

import { startTransition, useEffect, useRef, useState, type FormEvent } from "react";
import { EyeOpenIcon, EyeNoneIcon } from "@radix-ui/react-icons";
import { cancelSmsLogin, connectSms, continueSmsLogin, disconnectSms, loadSmsSubject, refreshSms, sendSmsLoginCode } from "@/app/actions/sms";
import { smsCopy } from "@/lib/sms/copy";
import { smsChallengeCopy } from "@/lib/sms/challenge-copy";
import type { SmsAssessment, SmsErrorCode, SmsResult } from "@/lib/sms/types";
import type { SubjectRow } from "@/lib/database.types";
import { subjectName } from "@/lib/i18n";
import { useI18n } from "./locale-provider";
import { SubjectMotif } from "./subject-motif";
import { ActionMenu } from "./action-menu";
import { assessmentCounts } from "@/lib/sms/presentation";
import { DiaryMotion } from "./diary-motion";

function RefreshIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M20 11a8 8 0 1 0-2.34 5.66" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M20 5v6h-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function ShieldIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M12 3 5.5 5.6v5.7c0 4.2 2.7 7.8 6.5 9.7 3.8-1.9 6.5-5.5 6.5-9.7V5.6L12 3Z" stroke="currentColor" strokeWidth="1.6"/><path d="m9.3 12 1.8 1.8 3.8-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function ChevronIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export function SmsDiary({enabled,sessionPresent,subjects=[]}:{enabled:boolean;sessionPresent:boolean;subjects?:SubjectRow[]}) {
  const {locale}=useI18n(), p=smsCopy(locale);
  const challengeCopy=smsChallengeCopy(locale);
  const [result,setResult]=useState<SmsResult>({connected:sessionPresent,...(!enabled?{error:"feature_disabled" as const}:{})});
  const [pending,setPending]=useState(sessionPresent&&enabled);
  const [details,setDetails]=useState<Record<string,{loading?:boolean;assessments?:SmsAssessment[];error?:SmsErrorCode}>>({});
  const [iin, setIin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const challengeForm=useRef<HTMLFormElement>(null);
  const challengeAnswers=useRef<Record<string,string>>({});
  const [resendWaiting,setResendWaiting]=useState(false);
  const challenge=result.challenge;
  useEffect(()=>{
    const remaining=(challenge?.resendAt??0)-Date.now();
    const update=window.setTimeout(()=>setResendWaiting(remaining>0),0);
    const unlock=window.setTimeout(()=>setResendWaiting(false),Math.max(0,remaining));
    return ()=>{window.clearTimeout(update);window.clearTimeout(unlock);};
  },[challenge?.resendAt]);
  useEffect(()=>{
    if(!challenge)return;
    challengeForm.current?.querySelector<HTMLInputElement>("input")?.focus();
    const timeout=window.setTimeout(()=>{
      ++requestId.current;
      challengeAnswers.current={};
      setIin("");setPassword("");setShowPassword(false);setPending(false);
      setResult({connected:false,error:"session_expired"});
    },Math.max(0,challenge.expiresAt-Date.now()));
    return ()=>window.clearTimeout(timeout);
  },[challenge]);
  const initialized=useRef(false);
  const termAutoselected=useRef(false);
  const requestId=useRef(0);
  const localeTag=locale==="kk"?"kk-KZ":locale==="ru"?"ru-KZ":"en-GB";
  useEffect(()=>{
    const hydrateCache=window.setTimeout(()=>{try {
      const cachedSnap = localStorage.getItem("sms_diary_snapshot");
      const cachedDet = localStorage.getItem("sms_diary_details");
      if (cachedSnap) setResult(prev => prev.snapshot ? prev : ({ ...prev, snapshot: JSON.parse(cachedSnap) }));
      if (cachedDet) setDetails(prev => Object.keys(prev).length ? prev : JSON.parse(cachedDet));
    } catch {}},0);

    if(initialized.current || !sessionPresent || !enabled) return ()=>window.clearTimeout(hydrateCache);
    initialized.current=true;
    const id=++requestId.current;
    refreshSms().then(value=>{if(requestId.current===id)setResult(value);},()=>{if(requestId.current===id)setResult({connected:true,error:"sms_unavailable"});})
      .finally(()=>{if(requestId.current===id)setPending(false);});
    return ()=>window.clearTimeout(hydrateCache);
  },[sessionPresent,enabled]);

  useEffect(() => {
    if (result.snapshot) {
      try {
        localStorage.setItem("sms_diary_snapshot", JSON.stringify(result.snapshot));
      } catch {}
    } else if (result.connected === false) {
      try {
        localStorage.removeItem("sms_diary_snapshot");
        localStorage.removeItem("sms_diary_details");
      } catch {}
    }
  }, [result]);

  useEffect(() => {
    if (Object.keys(details).length > 0) {
      try {
        localStorage.setItem("sms_diary_details", JSON.stringify(details));
      } catch {}
    }
  }, [details]);
  async function run(action:()=>Promise<SmsResult>) {
    const id=++requestId.current; setPending(true);
    try {const value=await action();if(requestId.current===id){setResult(value);setDetails({});}}
    catch {if(requestId.current===id)setResult({connected:result.connected,error:"sms_unavailable"});}
    finally {if(requestId.current===id)setPending(false);}
  }
  function connect(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(pending)return;
    const form=new FormData(event.currentTarget);
    form.set("iin", iin.trim());
    form.set("password", password);
    startTransition(()=>submitLogin(form));
  }
  async function submitLogin(form:FormData,sendCode=false) {
    for(const name of ["captchaInput","twoFactorAuthCode","application2FACode"]) {
      const answer=form.get(name);
      if(typeof answer==="string")challengeAnswers.current[name]=answer;
      else if(challengeAnswers.current[name])form.set(name,challengeAnswers.current[name]);
    }
    const id=++requestId.current; setPending(true);
    try {
      const value=await (sendCode?sendSmsLoginCode(form):challenge?continueSmsLogin(form):connectSms(form));
      if(requestId.current===id) {
        const retryable=value.error&&["busy","timeout","sms_unavailable","invalid_input","verification_failed"].includes(value.error);
        let retainedChallenge=value.challenge ?? (retryable?challenge:undefined);
        if(retainedChallenge?.captcha&&challenge?.captcha&&!retainedChallenge.image) {
          retainedChallenge={...retainedChallenge,image:challenge.image};
        }
        if(retainedChallenge?.image&&retainedChallenge.image!==challenge?.image)delete challengeAnswers.current.captchaInput;
        setResult(retainedChallenge?{...value,challenge:retainedChallenge}:value);
        setDetails({});
        if(value.connected) {
          setIin("");
          setPassword("");
          setShowPassword(false);
          challengeAnswers.current={};
        } else if(!retainedChallenge&&value.error!=="busy") {
          setIin("");
          setPassword("");
          setShowPassword(false);
          challengeAnswers.current={};
        }
      }
    } catch {
      if(requestId.current===id) {
        setResult({connected:result.connected,error:"sms_unavailable",...(challenge?{challenge}:{})});
        if(!challenge){setIin("");setPassword("");setShowPassword(false);challengeAnswers.current={};}
      }
    } finally {
      form.delete("iin");
      form.delete("password");
      form.delete("captchaInput");
      form.delete("twoFactorAuthCode");
      form.delete("application2FACode");
      if(requestId.current===id) setPending(false);
    }
  }
  function cancelLogin() {
    if(pending)return;
    setIin("");setPassword("");setShowPassword(false);
    challengeAnswers.current={};
    setResult({connected:false});
    startTransition(()=>run(cancelSmsLogin));
  }
  function sendCode() {
    if(pending||resendWaiting||!challengeForm.current)return;
    const form=new FormData(challengeForm.current);
    form.set("iin",iin.trim());form.set("password",password);
    startTransition(()=>submitLogin(form,true));
  }
  const snapshot=result.snapshot;
  useEffect(() => {
    if (pending || termAutoselected.current || !snapshot?.filters || snapshot.filters.termId || snapshot.filters.terms.length === 0) return;
    termAutoselected.current = true;
    const month = new Date().getMonth() + 1;
    const expected = month >= 9 && month <= 11 ? 1 : month === 12 || month <= 2 ? 2 : month <= 4 ? 3 : 4;
    const numeral = ["", "i", "ii", "iii", "iv"][expected];
    const preferred = snapshot.filters.terms.find((term) => {
      const label = term.label.toLocaleLowerCase();
      return new RegExp(`(^|\\s)${expected}([\\s.-]|$)`).test(label) || new RegExp(`(^|\\s)${numeral}([\\s.-]|$)`).test(label);
    }) ?? snapshot.filters.terms[0];
    void run(() => refreshSms({yearId:snapshot.filters!.yearId,termId:preferred.id}));
  }, [pending, snapshot]);
  function matchingSubject(name:string) {
    const normalize=(value:string)=>value.normalize("NFKC").toLocaleLowerCase().trim();
    const matches=subjects.filter(s=>[s.name,s.name_ru,s.name_kz,s.name_en,s.short_name].some(v=>v&&normalize(v)===normalize(name)));
    return matches.length===1?matches[0]:undefined;
  }
  const formatNumber=(value:number)=>new Intl.NumberFormat(localeTag,{maximumFractionDigits:1}).format(value);
  const selection=snapshot?.filters?{yearId:snapshot.filters.yearId,termId:snapshot.filters.termId}:{};
  async function loadDetails(subjectId:string) {
    const subject=snapshot?.subjects.find(item=>item.sourceId===subjectId);
    if(subject?.assessmentsLoaded||details[subjectId]?.loading||details[subjectId]?.assessments||!snapshot?.filters?.termId)return;
    setDetails(value=>({...value,[subjectId]:{loading:true}}));
    const loaded=await loadSmsSubject({yearId:snapshot.filters.yearId,termId:snapshot.filters.termId},subjectId);
    setDetails(value=>({...value,[subjectId]:loaded.assessments?{assessments:loaded.assessments}:{error:loaded.error||"sms_unavailable"}}));
  }

  const [openSubjects, setOpenSubjects] = useState<Record<string, boolean>>({});

  const hasAnyOpen = Object.values(openSubjects).some(Boolean);

  function toggleAllDetails() {
    const nextOpen = !hasAnyOpen;
    if (nextOpen && snapshot?.subjects) {
      const nextMap: Record<string, boolean> = {};
      snapshot.subjects.forEach((s) => {
        const key = s.sourceId ?? s.subject;
        nextMap[key] = true;
        if (s.sourceId) void loadDetails(s.sourceId);
      });
      setOpenSubjects(nextMap);
    } else {
      setOpenSubjects({});
    }
  }

  return <DiaryMotion><section className="sms-diary" aria-label={p.title} aria-busy={pending}>
    {!result.connected ? <div className="sms-connect-shell" data-diary-arrive>
      <div className="surface-card sms-connect">
        <p className="eyebrow">NIS Hub × SMS</p>
        <h2>{challenge?challengeCopy.title:p.connect}</h2>
        <p className="sms-connect-lead" id="sms-login-description" role={challenge?"status":undefined}>{challenge?challengeCopy.description:p.consent}</p>
        {challenge ? <form ref={challengeForm} onSubmit={connect} aria-describedby="sms-login-description sms-challenge-expiry">
          {challenge.captcha&&challenge.image&&<>
            {/* SMS supplies a session-bound data URI; it must not use the image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={challenge.image} alt={challengeCopy.imageAlt} style={{maxWidth:"100%",height:"auto"}}/>
            <label htmlFor="sms-captcha">{challengeCopy.captcha}</label>
            <input key={challenge.image} id="sms-captcha" className="field" name="captchaInput" required maxLength={128} autoComplete="off" spellCheck={false} disabled={pending}/>
          </>}
          {challenge.twoFactor&&<>
            <label htmlFor="sms-two-factor">{challengeCopy.twoFactor}</label>
            <button type="button" className="button button-secondary" onClick={sendCode} disabled={pending||resendWaiting}>{resendWaiting?challengeCopy.codeWait:challengeCopy.sendCode}</button>
            <input id="sms-two-factor" className="field" name="twoFactorAuthCode" required minLength={4} maxLength={4} autoComplete="one-time-code" inputMode="numeric" disabled={pending}/>
          </>}
          {challenge.application2FA&&<>
            <label htmlFor="sms-application-code">{challengeCopy.application}</label>
            <input id="sms-application-code" className="field" name="application2FACode" required minLength={6} maxLength={6} autoComplete="one-time-code" inputMode="numeric" disabled={pending}/>
          </>}
          <p id="sms-challenge-expiry">{challengeCopy.expires}: <time dateTime={new Date(challenge.expiresAt).toISOString()}>{new Intl.DateTimeFormat(localeTag,{hour:"2-digit",minute:"2-digit"}).format(challenge.expiresAt)}</time></p>
          <button className="button sms-connect-button" type="submit" disabled={!enabled||pending||(challenge.captcha&&!challenge.image)}>{pending?p.pending:challengeCopy.submit}</button>
          <button className="button button-secondary" type="button" disabled={pending} onClick={cancelLogin}>{challengeCopy.cancel}</button>
        </form> : <form onSubmit={connect} aria-describedby="sms-privacy">
          <label htmlFor="sms-iin">{p.iin}</label>
          <input
            id="sms-iin"
            name="iin"
            className="field"
            inputMode="numeric"
            autoComplete="username"
            pattern="[0-9]{12}"
            minLength={12}
            maxLength={12}
            required
            value={iin}
            onChange={(e) => setIin(e.target.value)}
            disabled={!enabled || pending}
          />
          <label htmlFor="sms-password">{p.password}</label>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <input
              id="sms-password"
              name="password"
              className="field"
              style={{ paddingRight: "2.75rem", width: "100%" }}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              maxLength={256}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!enabled || pending}
            />
            <button
              type="button"
              className="password-reveal-btn"
              style={{
                position: "absolute",
                right: "0.5rem",
                width: "32px",
                height: "32px",
                display: "grid",
                placeItems: "center",
                borderRadius: "8px",
                color: "var(--text-secondary)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeNoneIcon width={18} height={18} aria-hidden="true" />
              ) : (
                <EyeOpenIcon width={18} height={18} aria-hidden="true" />
              )}
            </button>
          </div>
          <button className="button sms-connect-button" type="submit" disabled={!enabled || pending}>
            {pending ? p.pending : p.connect}
          </button>
        </form>}
      </div>
      <aside className="sms-privacy-panel" id="sms-privacy">
        <span className="sms-privacy-icon"><ShieldIcon/></span>
        <div><strong>{p.source}</strong><p>{p.privacy}</p></div>
      </aside>
    </div> : <div className="sms-toolbar" data-diary-arrive>
      <div className="sms-toolbar-copy">
        <div className="sms-connection-state"><span className="sms-status-dot"/>{p.connected}</div>
        {snapshot?.student.displayName?<h2>{snapshot.student.displayName}</h2>:<h2>{p.title}</h2>}
        <p>{p.source}</p>
        {snapshot&&<p className="sms-updated">{p.updated}: <time dateTime={snapshot.fetchedAt}>{new Intl.DateTimeFormat(localeTag,{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Oral"}).format(new Date(snapshot.fetchedAt))}</time></p>}
      </div>
      <div className="sms-actions">
        {snapshot && snapshot.subjects.length > 0 && (
          <button
            type="button"
            className="button button-secondary sms-toggle-all"
            onClick={toggleAllDetails}
            disabled={pending}
          >
            <span style={{ display: "inline-block", transform: hasAnyOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }}>
              <ChevronIcon />
            </span>
            {hasAnyOpen
              ? (locale === "kk" ? "Барлығын жинау" : locale === "en" ? "Collapse all" : "Свернуть все")
              : (locale === "kk" ? "Барлығын ашу" : locale === "en" ? "Expand all" : "Развернуть все")}
          </button>
        )}
        <button className="button button-secondary sms-refresh" onClick={()=>void run(()=>refreshSms(selection))} disabled={!enabled||pending} aria-busy={pending}><RefreshIcon/>{p.refresh}</button>
        <ActionMenu label={p.actions}>{close=><button type="button" role="menuitem" disabled={pending} onClick={()=>{close();void run(disconnectSms);}}>{p.disconnect}</button>}</ActionMenu>
      </div>
      {snapshot&&<div className="sms-context" aria-label={`${p.year}, ${p.term}`}>
        {snapshot.student.className&&<div className="sms-context-readonly"><span>{p.className}</span><strong>{snapshot.student.className}</strong></div>}
        {snapshot.filters?<>
          <label className="sms-filter"><span>{p.year}</span><select value={snapshot.filters.yearId} disabled={pending} onChange={event=>void run(()=>refreshSms({yearId:event.currentTarget.value}))}>{snapshot.filters.years.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <label className="sms-filter"><span>{p.term}</span><select value={snapshot.filters.termId??""} disabled={pending} onChange={event=>void run(()=>refreshSms({yearId:snapshot.filters!.yearId,...(event.currentTarget.value?{termId:event.currentTarget.value}:{})}))}><option value="">{p.selectTerm}</option>{snapshot.filters.terms.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        </>:<>
          {snapshot.student.schoolYear&&<div className="sms-context-readonly"><span>{p.year}</span><strong>{snapshot.student.schoolYear}</strong></div>}
          {snapshot.student.term&&<div className="sms-context-readonly"><span>{p.term}</span><strong>{snapshot.student.term}</strong></div>}
        </>}
      </div>}
    </div>}
    {pending&&<div className="sms-progress" role="status"><span/>{p.pending}</div>}
    {result.error&&<p className="notice notice-error" role="alert" data-diary-arrive>{result.error==="interactive_required"?challengeCopy.unsupported:p.errors[result.error]}{result.error==="interactive_required"&&<> <a href="https://sms.ura.nis.edu.kz" target="_blank" rel="noopener noreferrer">{challengeCopy.official}</a></>}</p>}
    {snapshot&&!pending&&<div className="sms-subjects">
      {!snapshot.subjects.length&&<p className="surface-card sms-empty">{snapshot.filters&&!snapshot.filters.termId?p.selectTerm:p.empty}</p>}
      {snapshot.subjects.map((s,index)=>{
        const subject=matchingSubject(s.subject);
        const detail=s.sourceId?details[s.sourceId]:undefined;
        const assessments=detail?.assessments??s.assessments;
        const counts=s.assessmentsLoaded||detail?.assessments?assessmentCounts(s,detail?.assessments):undefined;
        return <article className={`sms-subject${snapshot.subjects.length%2===1&&index===snapshot.subjects.length-1?" sms-subject-wide":""}`} key={s.sourceId??s.subject} data-diary-card>
          <header className="sms-subject-heading">
            <div data-diary-motif><SubjectMotif subject={subject}/></div>
            <div className="sms-subject-title"><h2>{subject?subjectName(subject,locale):s.subject}</h2>
              <div className="sms-result-line"><strong>{s.percent===undefined?"—":formatNumber(s.percent)+"%"}</strong><span>{s.percent===undefined?p.noScore:s.percentSource==="derived"?p.derived:p.official}</span></div>
            </div>
          </header>
          <div className="sms-mark" data-unattested={!!s.notAttested}>
            <span className="sms-mark-label">{p.currentMark}</span>
            <div className="sms-mark-status">
              <strong>{s.notAttested?p.notAttested:s.currentMark===undefined?"—":formatNumber(s.currentMark)}</strong>
              {s.currentMark===undefined&&!s.notAttested&&<small>{p.noScore}</small>}
            </div>
          </div>
          <dl className="sms-work-counts" aria-label={p.assessment}>
            <div className="sms-count-chip"><dt>{p.works}</dt><dd>{counts?.works??"—"}</dd></div>
            <div className="sms-count-chip"><dt>{p.types.sor}</dt><dd>{counts?.sor??"—"}</dd></div>
            <div className="sms-count-chip"><dt>{p.types.soch}</dt><dd>{counts?.soch??"—"}</dd></div>
          </dl>
          <details
            className="sms-subject-details"
            open={!!openSubjects[s.sourceId ?? s.subject]}
            onToggle={(event) => {
              const currentOpen = event.currentTarget.open;
              const sKey = s.sourceId ?? s.subject;
              if (currentOpen !== !!openSubjects[sKey]) {
                setOpenSubjects((prev) => ({ ...prev, [sKey]: currentOpen }));
                if (currentOpen && s.sourceId) void loadDetails(s.sourceId);
              }
            }}
          >
            <summary><span>{p.assessment}{s.assessmentsLoaded||detail?.assessments?` · ${assessments.length}`:""}</span><ChevronIcon/></summary>
            {detail?.loading&&<p className="sms-detail-state" role="status">{p.detailsLoading}</p>}
            {detail?.error&&<p className="sms-detail-state notice-error" role="alert">{p.errors[detail.error]}</p>}
            {!detail?.loading&&!detail?.error&&<ol className="sms-assessments">{assessments.map((a,assessmentIndex)=><li key={`${a.title??a.type??"assessment"}-${assessmentIndex}`}>
              <div className="sms-assessment-copy"><strong>{a.title || (a.type?p.types[a.type]:p.assessment)}</strong>{a.title&&a.type&&<span>{p.types[a.type]}</span>}
                {a.date&&<time dateTime={a.date}>{new Intl.DateTimeFormat(localeTag,{dateStyle:"medium",timeZone:"UTC"}).format(new Date(a.date+"T12:00:00Z"))}</time>}
              </div><div className="sms-assessment-score"><span>{p.score}</span><strong>{a.score??"—"}{a.max!==undefined?" / "+a.max:""}</strong>
                {a.percent!==undefined&&<small>{formatNumber(a.percent)}% · {a.percentSource==="derived"?p.derived:p.official}</small>}
              </div>
            </li>)}</ol>}
          </details>
        </article>;
      })}
    </div>}
  </section></DiaryMotion>;
}
