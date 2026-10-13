"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from "@radix-ui/react-icons";
import { saveSchool, finishSchoolOnboarding } from "@/app/actions/schools";
import type { ClassRow, Profile, SubjectRow } from "@/lib/database.types";
import { cityById, schoolById, schoolLabel, validSchoolSelection } from "@/lib/schools";
import { schoolCopy } from "@/lib/school-copy";
import { useI18n } from "./locale-provider";
import { KazakhstanSchoolPicker, type SchoolSelection } from "./ui/kazakhstan-school-picker";
import { ProfileForm } from "./profile-form";
import {deferActivityUntilReload} from "@/lib/activity-visibility";
import {firstVisitCopy} from "@/lib/first-visit-copy";

export function SchoolOnboarding({ profile, classes, subjects, top }: {
  profile: Profile; classes: ClassRow[]; subjects: SubjectRow[]; top: string[];
}) {
  const { locale } = useI18n(), p = schoolCopy(locale), friendly=firstVisitCopy(locale), router = useRouter();
  const initialSchool = schoolById(profile.school_id);
  const [selection, setSelection] = useState<SchoolSelection>({ city: initialSchool?.city_id ?? "", school: initialSchool?.id ?? "" });
  const [step, setStep] = useState<"school" | "profile">(initialSchool ? "profile" : "school");
  const [savedSchool, setSavedSchool] = useState(initialSchool?.id ?? "");
  const [draftSchool, setDraftSchool] = useState(initialSchool?.id ?? "");
  const [draftProfile, setDraftProfile] = useState({ display_name: profile.display_name, class_id: profile.class_id, bio: profile.bio });
  const [draftTop, setDraftTop] = useState(top);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null), previousStep = useRef(step);
  const profileArea = useRef<HTMLDivElement>(null);
  const complete = useCallback(() => { router.replace("/"); router.refresh(); }, [router]);
  useEffect(()=>{deferActivityUntilReload(profile.id);},[profile.id]);
  useEffect(() => {
    if (previousStep.current !== step) heading.current?.focus({ preventScroll: true });
    previousStep.current = step;
  }, [step]);
  const selected = schoolById(savedSchool), city = cityById(selected?.city_id);
  const schoolClasses = classes.filter(row => row.school_id === savedSchool);
  return <main id="main" className="school-onboarding">
    <ol className="school-onboarding-steps" aria-label={locale === "kk" ? "Баптау қадамдары" : locale === "en" ? "Setup steps" : "Шаги настройки"}>
      <li aria-current={step === "school" ? "step" : undefined} data-done={step === "profile"}>
        <span>{step === "profile" ? <CheckIcon aria-hidden="true" /> : "1"}</span>{p.stepSchool}
      </li><li aria-current={step === "profile" ? "step" : undefined}><span>2</span>{p.stepProfile}</li>
    </ol>
    <div className="school-onboarding-screen" key={step}>
      <header className="school-onboarding-heading">
        <p>{p.welcome}</p><h1 ref={heading} tabIndex={-1}>{step === "school" ? p.title : p.profileTitle}</h1>
        <span>{step === "school" ? p.intro : friendly.profileIntro}</span>
      </header>
      {step === "school" ? <>
        <KazakhstanSchoolPicker value={selection} onChange={value => { setSelection(value); setError(""); }} disabled={pending} />
        <div className="school-onboarding-footer">
          <p role="status">{!selection.city?friendly.cityPrompt:!selection.school?friendly.schoolPrompt:friendly.nextProfile}</p>
          <button className="school-continue" type="button" disabled={pending || !validSchoolSelection(selection.city, selection.school)}
            onClick={() => start(async () => {
              setError("");
              try {
                const result = await saveSchool(selection);
                if (result.error) { setError(result.error); return; }
                setSavedSchool(selection.school); setStep("profile");
              } catch { setError(p.error); }
            })}>{pending ? p.saving : p.continue}<ArrowRightIcon aria-hidden="true" /></button>
        </div>
        {error && <p className="form-error school-save-error" role="alert">{error}</p>}
      </> : <div className="school-profile-step" ref={profileArea}>
        <div className="school-selection-summary glass-surface">
          <div><span>{p.selected}{city && ` · ${schoolLabel(city, locale)}`}</span><strong>{selected ? schoolLabel(selected, locale) : ""}</strong></div>
          <button type="button" className="button button-secondary" onClick={() => {
            const form = profileArea.current?.querySelector("form");
            if (form) {
              const data = new FormData(form);
              setDraftProfile({ display_name: String(data.get("display_name") ?? ""), class_id: String(data.get("class_id") ?? "") || null, bio: String(data.get("bio") ?? "") });
              setDraftTop(data.getAll("subjects").map(String)); setDraftSchool(savedSchool);
            }
            setStep("school");
          }}><ArrowLeftIcon aria-hidden="true" />{p.change}</button>
        </div>
        <ProfileForm key={savedSchool} classes={schoolClasses} subjects={subjects}
          profile={{ ...draftProfile, class_id: draftSchool === savedSchool ? draftProfile.class_id : null }}
          top={draftTop} hasAvatar={!!profile.avatar_path} completeAction={finishSchoolOnboarding} onComplete={complete}
          classHint={p.noClasses} />
        <p className="first-visit-photo-hint">{friendly.photoLater}</p>
      </div>}
    </div>
  </main>;
}
