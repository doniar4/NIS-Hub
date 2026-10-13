"use client";

import { useState } from "react";
import type { ClassHomework } from "@/lib/database.types";
import { homeworkKind, homeworkKindCopy, type HomeworkKind } from "@/lib/homework-kind";
import { v053Copy } from "@/lib/v053-copy";
import { useI18n } from "./locale-provider";

export function HomeworkFields({ edit, disabled = false, autoFocus = false }: {
  edit?: ClassHomework | null; disabled?: boolean; autoFocus?: boolean;
}) {
  const { locale } = useI18n(), p = homeworkKindCopy(locale);
  const [kind, setKind] = useState<HomeworkKind>(edit ? homeworkKind(edit) : "homework");
  return <>
    <fieldset className="homework-kind-field" disabled={disabled}>
      <legend className="field-label">{p.category}</legend>
      <div className="homework-kind-options">
        {(["homework", "sor"] as const).map(value => <label className="homework-kind-option" data-kind={value} key={value}>
          <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} />
          <span>{p[value]}</span>
        </label>)}
      </div>
      {kind === "sor" && <p className="homework-kind-hint">{p.hint}</p>}
    </fieldset>
    <label className="block">
      <span className="field-label">{kind === "sor" ? p.topics : p.body}{kind === "sor" && <small className="homework-optional">{p.optional}</small>}</span>
      <textarea className="field w-full" name="body" rows={3} required={kind === "homework"} maxLength={1000}
        disabled={disabled} data-dialog-autofocus={autoFocus || undefined}
        placeholder={kind === "sor" ? p.placeholder : v053Copy(locale).homeworkPlaceholder}
        defaultValue={edit && homeworkKind(edit) === "sor" && /^(сор|sor|бжб)$/iu.test(edit.body.trim()) ? "" : edit?.body ?? ""} />
    </label>
  </>;
}
