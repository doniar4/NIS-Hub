"use client";
import { useI18n } from "@/components/locale-provider";
import { FlameButton } from "@/components/ui/flame-button";
import { startTransition, useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import type { ActionState, FormAction } from "@/lib/action-state";
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
    const [remaining, setRemaining] = useState(0);
    const deadline = useRef(0);
    const submitting = useRef(false);
    const formRef = useRef<HTMLFormElement>(null);
    const draft = useRef<FormData | null>(null);
    const [state, formAction, pending] = useActionState(async (previous: ActionState, form: FormData) => {
        if (submitting.current || Date.now() < deadline.current) return previous;
        submitting.current = true;
        draft.current = form;
        try {
            const result = await action(previous, form);
            const seconds = Math.min(3600, Math.max(0, result.retryAfterSeconds ?? 0));
            deadline.current = Date.now() + seconds * 1000;
            setRemaining(seconds);
            return result;
        } finally { submitting.current = false; }
    }, {});
    useEffect(() => {
        if (!remaining) return;
        const timer = window.setInterval(() => setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))), 1000);
        return () => window.clearInterval(timer);
    }, [remaining]);
    const feedback = useRef<HTMLParagraphElement>(null);
    useEffect(() => {
        // React resets uncontrolled forms after any resolved action, including an
        // error result. Preserve the draft so retries don't silently submit blanks.
        if (state.error && draft.current && formRef.current) {
            for (const control of Array.from(formRef.current.elements)) {
                if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) || !control.name) continue;
                const values = draft.current.getAll(control.name);
                if (control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio"))
                    control.checked = values.includes(control.value);
                else if (control instanceof HTMLInputElement && control.type === "file") {
                    const transfer = new DataTransfer();
                    for (const value of values) if (value instanceof File && value.size) transfer.items.add(value);
                    control.files = transfer.files;
                } else if (control instanceof HTMLSelectElement && control.multiple)
                    for (const option of Array.from(control.options)) option.selected = values.includes(option.value);
                else control.value = typeof values[0] === "string" ? values[0] : "";
            }
            feedback.current?.focus();
        }
        draft.current = null;
    }, [state]);
    return <form ref={formRef} data-lenis-prevent action={manualSubmit ? undefined : formAction} className={className}
      onKeyDown={manualSubmit ? event => {
        if (event.key === "Enter" && event.target instanceof HTMLInputElement && event.target.type !== "submit") event.preventDefault();
      } : undefined}
      onSubmit={manualSubmit ? event => {
        event.preventDefault();
        if (pending || disabled || remaining > 0) return;
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      } : undefined}>
    <fieldset className="min-w-0 space-y-5" disabled={pending || disabled}>{children}
      {submitVariant === "flame"
        ? <FlameButton disabled={pending || disabled || remaining > 0} type="submit">{pending ? t.pending : remaining ? t.authRetryIn.replace("{seconds}", String(remaining)) : label}</FlameButton>
        : <button className="button" disabled={pending || disabled || remaining > 0} type="submit">{pending ? t.pending : remaining ? t.authRetryIn.replace("{seconds}", String(remaining)) : label}</button>}
    </fieldset>
    {state.error && <p className="form-error" role="alert" tabIndex={-1} ref={feedback}>{state.error}</p>}
    {state.success && <p className="text-sm text-[var(--success)]" role="status">{state.success}</p>}
  </form>;
}
