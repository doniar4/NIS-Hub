"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Check, CircleCheck, CloudCheck, LoaderCircle } from "lucide-react";
import { saveProfile } from "@/app/actions/profile";
import type { SubjectRow } from "@/lib/database.types";
import { profileCopy } from "@/lib/profile-copy";
import { v053Copy } from "@/lib/v053-copy";
import { communityCopy } from "@/lib/community-copy";
import { Field, SelectField } from "./fields";
import { TopSubjects } from "./top-subjects";
import { useI18n } from "./locale-provider";
import type { FormAction } from "@/lib/action-state";
import {firstVisitCopy} from "@/lib/first-visit-copy";
import { schoolCopy } from "@/lib/school-copy";

type Status = "idle" | "dirty" | "saving" | "saved" | "error";

function snapshot(form: HTMLFormElement) {
  const data = new FormData(form);
  return JSON.stringify([
    String(data.get("display_name") ?? "").trim(),
    String(data.get("class_id") ?? ""),
    String(data.get("bio") ?? "").trim(),
    data.getAll("subjects").map(String),
  ]);
}

export function ProfileForm({ classes, subjects, profile, top, hasAvatar, completeAction, onComplete, classHint }: {
  classes: { id: string; name: string }[];
  subjects: SubjectRow[];
  profile: { display_name: string | null; class_id: string | null; bio: string | null };
  top: string[];
  hasAvatar: boolean;
  completeAction?: FormAction;
  onComplete?: () => void;
  classHint?: string;
}) {
  const { t, locale } = useI18n(), p = profileCopy(locale), c = communityCopy(locale), v = v053Copy(locale);
  const form = useRef<HTMLFormElement>(null);
  const saved = useRef("");
  const baselineReady = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const inFlight = useRef(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [steps, setSteps] = useState({ name: !!profile.display_name?.trim(), cls: !!profile.class_id, top: top.filter(Boolean).length===4&&new Set(top.filter(Boolean)).size===4 });

  const refresh = useCallback(() => {
    const el = form.current;
    if (!el) return false;
    const data = new FormData(el);
    setSteps({ name: !!String(data.get("display_name") ?? "").trim(), cls: !!data.get("class_id"), top: data.getAll("subjects").filter(Boolean).length===4&&new Set(data.getAll("subjects").filter(Boolean)).size===4 });
    const dirty = snapshot(el) !== saved.current;
    setStatus(current => dirty ? (current === "saving" ? current : "dirty") : current === "dirty" ? "idle" : current);
    return dirty;
  }, []);

  const save = useCallback((finish = false) => {
    const el = form.current;
    window.clearTimeout(timer.current);
    if (inFlight.current) return;
    if (!el || (!finish && snapshot(el) === saved.current)) return;
    if (!el.checkValidity()) { el.reportValidity(); return; }
    const sent = snapshot(el), data = new FormData(el);
    inFlight.current = true;
    setStatus("saving");
    setError("");
    start(async () => {
      try {
        const result = await (finish && completeAction ? completeAction : saveProfile)({}, data);
        if (result.error) { setError(result.error); setStatus("error"); return; }
        saved.current = sent;
        setStatus(form.current && snapshot(form.current) !== sent ? "dirty" : "saved");
        window.dispatchEvent(new Event("nis-profile-saved"));
        if (finish) onComplete?.();
      } catch {
        setError(t.saveError);
        setStatus("error");
      } finally { inFlight.current = false; }
    });
  }, [t.saveError, completeAction, onComplete]);

  const schedule = useCallback((delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const el = form.current;
      // Autosave only valid forms silently; the explicit button reports problems.
      if (el && el.checkValidity()) save();
    }, delay);
  }, [save]);

  useEffect(() => {
    if (status !== "dirty" || pending) return;
    // Edits made during a slow save must be sent after that save completes.
    schedule(2000);
    return () => window.clearTimeout(timer.current);
  }, [status, pending, schedule]);

  useEffect(() => {
    const el = form.current;
    if (!el) return;
    // A locale change replaces event handlers, not the last persisted values.
    // Otherwise an unsaved bio is silently accepted as the saved baseline.
    if (!baselineReady.current) {
      saved.current = snapshot(el);
      baselineReady.current = true;
    } else if (snapshot(el) !== saved.current) {
      schedule(150);
    }
    const onInput = (event: Event) => {
      if (!refresh()) return;
      const target = event.target as HTMLElement;
      schedule(target instanceof HTMLSelectElement || target.tagName === "FIELDSET" ? 700 : 2000);
    };
    const onBlur = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      if ((target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) && refresh()) schedule(150);
    };
    const onLeave = (event: BeforeUnloadEvent) => {
      if (form.current && snapshot(form.current) !== saved.current) { event.preventDefault(); event.returnValue = p.leaveWarning; }
    };
    el.addEventListener("input", onInput);
    el.addEventListener("change", onInput);
    el.addEventListener("focusout", onBlur);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      el.removeEventListener("input", onInput);
      el.removeEventListener("change", onInput);
      el.removeEventListener("focusout", onBlur);
      window.removeEventListener("beforeunload", onLeave);
      window.clearTimeout(timer.current);
    };
  }, [p.leaveWarning, refresh, schedule]);

  useEffect(() => {
    if (status !== "saved") return;
    const id = window.setTimeout(() => setStatus(s => s === "saved" ? "idle" : s), 2600);
    return () => window.clearTimeout(id);
  }, [status]);

  const checklist = [
    { done: steps.name, label: p.stepName },
    { done: steps.cls, label: p.stepClass },
    { done: hasAvatar, label: p.stepAvatar },
    { done: steps.top, label: p.stepTop },
  ];
  const doneCount = checklist.filter(s => s.done).length;
  const busy = pending || status === "saving";

  return (
    <form
      data-lenis-prevent
      id="profile-form"
      ref={form}
      className="surface-card profile-form space-y-6"
      data-status={status}
      onSubmit={event => { event.preventDefault(); save(!!completeAction); }}
    >
      {!completeAction && doneCount < checklist.length && (
        <div className="profile-progress" role="group" aria-label={`${p.progress}: ${doneCount}/${checklist.length}`}>
          <div className="profile-progress-head"><strong>{p.progress}</strong><span>{doneCount}/{checklist.length}</span></div>
          <progress className="profile-progress-track" value={doneCount} max={checklist.length} aria-label={p.progress} />
          <ul>{checklist.map((step, index) => <li key={step.label} data-done={step.done}><span className="profile-step-mark" aria-hidden="true">{step.done ? <Check size={13} /> : index + 1}</span>{step.label}</li>)}</ul>
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <div data-missing={!steps.name || undefined} className="profile-field" id="profile-name">
          <Field label={t.displayName} name="display_name" defaultValue={profile.display_name ?? ""} required maxLength={60} autoComplete="nickname" />
        </div>
        <div data-missing={!steps.cls || undefined} className="profile-field" id="profile-class">
          {classes.length || !classHint ? <SelectField label={t.class} name="class_id" options={classes} value={profile.class_id} />
            : <><input type="hidden" name="class_id" value="" /><p className="school-class-hint">{classHint}</p></>}
        </div>
      </div>
      <p className="text-sm text-[var(--muted)] profile-hint">{c.nameHint}</p>
      <label className="block"><span className="field-label">{v.bio} <small>· {firstVisitCopy(locale).optional}</small></span><textarea className="field" name="bio" maxLength={280} rows={3} defaultValue={profile.bio ?? ""} aria-describedby="bio-hint" /></label>
      <p id="bio-hint" className="text-sm text-[var(--muted)] profile-hint">{v.bioHint}</p>
      <TopSubjects subjects={subjects} initial={top} />

      <div className="profile-save-bar" data-status={status} aria-live="polite">
        <span className="profile-save-status">
          {status === "saving" ? <><LoaderCircle size={16} className="spin" aria-hidden="true" />{p.autosaving}</>
            : status === "saved" ? <><CircleCheck size={16} aria-hidden="true" />{p.saved}</>
            : status === "dirty" ? <><i className="profile-save-dot" aria-hidden="true" />{p.unsaved}</>
            : status === "error" ? <span className="form-error" role="alert">{error}</span>
            : <><CloudCheck size={16} aria-hidden="true" />{p.savedAuto}</>}
        </span>
        <button className="button button-small" type="submit" disabled={busy || (!completeAction && (status === "idle" || status === "saved"))}>
          {busy ? t.pending : completeAction ? schoolCopy(locale).finish : p.save}
        </button>
      </div>
    </form>
  );
}
