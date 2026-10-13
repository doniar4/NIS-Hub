"use client";
import { useI18n } from "@/components/locale-provider";
import { FlameButton } from "@/components/ui/flame-button";
import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import type { FormAction } from "@/lib/action-state";
export function ActionForm({ action, children, label, className = "space-y-5", disabled = false, submitVariant = "default", manualSubmit = false }: {
    action: FormAction;
    children?: ReactNode;
    label: string;
    className?: string;
    disabled?: boolean;
    submitVariant?: "default" | "flame";
    manualSubmit?: boolean;
}) {
    const { t } = useI18n();
    const [state, formAction, pending] = useActionState(action, {});
    const feedback = useRef<HTMLParagraphElement>(null);
    useEffect(() => { if (state.error)
        feedback.current?.focus(); }, [state]);
    return <form action={manualSubmit ? undefined : formAction} className={className}
      onKeyDown={manualSubmit ? event => {
        if (event.key === "Enter" && event.target instanceof HTMLInputElement && event.target.type !== "submit") event.preventDefault();
      } : undefined}
      onSubmit={manualSubmit ? event => {
        // Dispatch explicitly so React does not reset uncontrolled profile fields,
        // including when the server returns a validation or database error.
        event.preventDefault();
        if (pending || disabled) return;
        const form = new FormData(event.currentTarget);
        startTransition(() => formAction(form));
      } : undefined}>
    <fieldset className="min-w-0 space-y-5" disabled={pending || disabled}>{children}
      {submitVariant === "flame"
        ? <FlameButton disabled={pending || disabled} type="submit">{pending ? t.pending : label}</FlameButton>
        : <button className="button" disabled={pending || disabled} type="submit">{pending ? t.pending : label}</button>}
    </fieldset>
    {state.error && <p className="form-error" role="alert" tabIndex={-1} ref={feedback}>{state.error}</p>}
    {state.success && <p className="text-sm text-[var(--success)]" role="status">{state.success}</p>}
  </form>;
}
