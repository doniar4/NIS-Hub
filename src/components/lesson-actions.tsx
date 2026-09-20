"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { PlusIcon, CheckIcon } from "@radix-ui/react-icons";
import type { CommunityError } from "@/lib/people";
import { v053Copy } from "@/lib/v053-copy";
import { useI18n } from "./locale-provider";
import { BookIcon } from "./icons";
import { ActionMenu } from "./action-menu";
import { TaskDialog } from "./task-dialog";

export function LessonActions({
  subjectId,
  subject,
  href,
  date,
  canAddHomework = false,
}: {
  subjectId: string;
  subject: string;
  href: string;
  date?: string;
  canAddHomework?: boolean;
}) {
  const { locale } = useI18n();
  const p = v053Copy(locale);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<CommunityError | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="lesson-actions">
      <Link
        prefetch={false}
        className="button button-secondary timetable-materials"
        href={href}
        aria-label={`${p.materials}: ${subject}`}
      >
        <BookIcon />
        <span>{p.materialsShort}</span>
      </Link>
      {canAddHomework && date && (
        <ActionMenu label={`${p.lessonActions}: ${subject}`}>
          {(close) => (
            <button
              role="menuitem"
              type="button"
              className="menu-action"
              onClick={() => {
                close();
                setError(null);
                setSaved(false);
                setEditing(true);
              }}
            >
              <PlusIcon />
              {p.addHomework}
            </button>
          )}
        </ActionMenu>
      )}
      {saved && (
        <span className="lesson-saved" role="status">
          <CheckIcon />
          {p.homeworkSaved}
        </span>
      )}
      {editing && (
        <TaskDialog
          title={p.addHomework}
          subtitle={subject}
          busy={pending}
          onClose={() => setEditing(false)}
        >
          <form
            className="homework-quick-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (pending) return;
              const data = new FormData(event.currentTarget);
              start(async () => {
                try {
                  const { saveHomework } =
                    await import("@/app/actions/homework");
                  const result = await saveHomework({
                    id: null,
                    subject: subjectId,
                    date: data.get("date"),
                    body: data.get("body"),
                  });
                  if ("error" in result) {
                    setError(result.error);
                    return;
                  }
                  setEditing(false);
                  setSaved(true);
                  window.dispatchEvent(new Event("nis-homework-change"));
                } catch {
                  setError("failed");
                }
              });
            }}
          >
            <label>
              <span className="field-label">{p.body}</span>
              <textarea
                className="field"
                name="body"
                rows={4}
                required
                maxLength={1000}
                data-dialog-autofocus
                disabled={pending}
                placeholder={p.homeworkPlaceholder}
              />
            </label>
            <label>
              <span className="field-label">{p.due}</span>
              <input
                className="field"
                type="date"
                name="date"
                required
                defaultValue={date}
                disabled={pending}
              />
            </label>
            <p className="task-hint">{p.homeworkHint}</p>
            {error && (
              <p role="alert" className="form-error">
                {p[error]}
              </p>
            )}
            <footer className="task-dialog-actions">
              <button
                type="button"
                className="button button-secondary"
                disabled={pending}
                onClick={() => setEditing(false)}
              >
                {p.cancel}
              </button>
              <button className="button" disabled={pending}>
                {pending ? p.saving : p.save}
              </button>
            </footer>
          </form>
        </TaskDialog>
      )}
    </div>
  );
}
