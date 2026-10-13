"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GlobeIcon, ArrowRightIcon } from "@radix-ui/react-icons";
import { saveSchool } from "@/app/actions/schools";
import { schoolById, cityById, schoolLabel, validSchoolSelection } from "@/lib/schools";
import { schoolCopy } from "@/lib/school-copy";
import { useI18n } from "./locale-provider";
import { KazakhstanSchoolPicker, type SchoolSelection } from "./ui/kazakhstan-school-picker";

export function SchoolSettings({ schoolId, hasClass }: { schoolId?: string | null; hasClass: boolean }) {
  const { locale } = useI18n(), p = schoolCopy(locale), router = useRouter();
  const school = schoolById(schoolId), city = cityById(school?.city_id);
  const [open, setOpen] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [selection, setSelection] = useState<SchoolSelection>({ city: school?.city_id ?? "", school: school?.id ?? "" });
  const [pending, start] = useTransition();
  return <section id="school-settings" className="surface-card school-settings" aria-label={p.stepSchool}>
    <div className="school-settings-summary"><GlobeIcon className="school-settings-icon" aria-hidden="true" />
      <div><span>{city ? schoolLabel(city, locale) : p.cityPlaceholder}</span><h2>{school ? schoolLabel(school, locale) : p.chooseSchool}</h2></div>
      <button type="button" className="button button-secondary" aria-expanded={open} aria-controls="school-settings-picker"
        disabled={pending} onClick={() => { setSelection({ city: school?.city_id ?? "", school: school?.id ?? "" }); setOpen(value => !value); setError(""); setMessage(""); }}>{p.change}</button>
    </div>
    {open && <div id="school-settings-picker" className="school-settings-editor">
      <KazakhstanSchoolPicker value={selection} onChange={value => { setSelection(value); setError(""); }} disabled={pending} />
      {hasClass && selection.school && selection.school !== schoolId && <p className="school-class-hint">{p.classReset}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="school-settings-actions"><button type="button" className="button button-secondary" disabled={pending} onClick={() => setOpen(false)}>{p.cancel}</button>
        <button type="button" className="school-continue" disabled={pending || !validSchoolSelection(selection.city, selection.school)}
          onClick={() => start(async () => {
            setError("");
            try {
              const result = await saveSchool(selection);
              if (result.error) { setError(result.error); return; }
              setOpen(false); setMessage(p.saved); router.refresh(); window.dispatchEvent(new Event("nis-profile-saved"));
            } catch { setError(p.error); }
          })}>{pending ? p.saving : p.save}<ArrowRightIcon aria-hidden="true" /></button>
      </div>
    </div>}
    {message && <p className="school-settings-feedback" role="status">{message}</p>}
  </section>;
}
