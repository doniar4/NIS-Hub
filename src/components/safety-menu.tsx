"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  EyeNoneIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  LockOpen1Icon,
  TrashIcon,
} from "@radix-ui/react-icons";
import { safetyAction } from "@/app/actions/community-safety";
import { v053Copy } from "@/lib/v053-copy";
import type { CommunityError } from "@/lib/people";
import { useI18n } from "./locale-provider";
import { ActionMenu } from "./action-menu";
import { TaskDialog } from "./task-dialog";

export function SafetyMenu({
  peer,
  thread,
  message,
  own = false,
  homework,
  blocked = false,
  onDone,
}: {
  peer?: string;
  thread?: string;
  message?: string;
  own?: boolean;
  homework?: string;
  blocked?: boolean;
  onDone?: () => void;
}) {
  const { locale } = useI18n(),
    p = v053Copy(locale),
    router = useRouter();
  const [report, setReport] = useState(false),
    [error, setError] = useState<CommunityError | null>(null),
    [done, setDone] = useState(false),
    [pending, start] = useTransition();
  function act(input: unknown) {
    start(async () => {
      setError(null);
      setDone(false);
      try {
        const result = await safetyAction(input);
        if ("error" in result) setError(result.error);
        else {
          setDone(true);
          setReport(false);
          window.dispatchEvent(new Event("nis-notifications-change"));
          onDone?.();
          router.refresh();
        }
      } catch {
        setError("failed");
      }
    });
  }
  const target = message ?? homework ?? peer,
    kind = message ? "message" : homework ? "homework" : "profile";
  return (
    <div className="safety-control">
      <ActionMenu label={p.safety}>
        {(close) => (
          <>
            {peer && (
              <button
                role="menuitem"
                className="menu-action"
                disabled={pending}
                onClick={() => {
                  close();
                  act({ action: blocked ? "unblock" : "block", id: peer });
                }}
              >
                {blocked ? <LockOpen1Icon /> : <LockClosedIcon />}
                {blocked ? p.unblock : p.block}
              </button>
            )}
            {thread && (
              <button
                role="menuitem"
                className="menu-action"
                disabled={pending}
                title={p.hideHint}
                onClick={() => {
                  close();
                  act({ action: "hide", id: thread });
                }}
              >
                <EyeNoneIcon />
                {p.hide}
              </button>
            )}
            {message && own && (
              <button
                role="menuitem"
                className="menu-action menu-action-danger"
                disabled={pending}
                onClick={() => {
                  close();
                  act({ action: "delete", id: message });
                }}
              >
                <TrashIcon />
                {p.deleteOwn}
              </button>
            )}
            {target && !own && !blocked && (
              <button
                role="menuitem"
                className="menu-action menu-action-danger"
                onClick={() => {
                  close();
                  setError(null);
                  setReport(true);
                }}
              >
                <ExclamationTriangleIcon />
                {p.report}
              </button>
            )}
          </>
        )}
      </ActionMenu>
      {report && target && (
        <TaskDialog
          title={p.report}
          onClose={() => setReport(false)}
          busy={pending}
        >
          <form
            className="homework-quick-form"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              act({
                action: "report",
                id: target,
                kind,
                reason: data.get("reason"),
                detail: data.get("detail"),
              });
            }}
          >
            <label>
              <span className="field-label">{p.reason}</span>
              <select
                className="field"
                name="reason"
                data-dialog-autofocus
                disabled={pending}
              >
                {(["spam", "harassment", "privacy", "other"] as const).map(
                  (key) => (
                    <option key={key} value={key}>
                      {p[key]}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              <span className="field-label">{p.details}</span>
              <textarea
                className="field"
                name="detail"
                rows={3}
                maxLength={500}
                disabled={pending}
              />
            </label>
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
                onClick={() => setReport(false)}
              >
                {p.cancel}
              </button>
              <button className="button" disabled={pending}>
                {p.report}
              </button>
            </footer>
          </form>
        </TaskDialog>
      )}
      {error && !report && (
        <p role="alert" className="control-feedback">
          {p[error]}
        </p>
      )}
      {done && (
        <span role="status" className="sr-only">
          {p.sent}
        </span>
      )}
    </div>
  );
}
