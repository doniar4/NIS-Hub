"use client";
import { useI18n } from "@/components/locale-provider";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { FormAction } from "@/lib/action-state";
export function ActionForm({ action, children, label, className = "space-y-5", disabled = false }: {
    action: FormAction;
    children?: ReactNode;
    label: string;
    className?: string;
    disabled?: boolean;
}) {
    const { t } = useI18n();
    const [state, formAction, pending] = useActionState(action, {});
    const feedback = useRef<HTMLParagraphElement>(null);
    useEffect(() => { if (state.error)
        feedback.current?.focus(); }, [state]);
    return <form action={formAction} className={className}>
    <fieldset className="min-w-0 space-y-5" disabled={pending || disabled}>{children}
      <button className="button" disabled={pending || disabled} type="submit">{pending ? t.pending : label}</button>
    </fieldset>
    {state.error && <p className="form-error" role="alert" tabIndex={-1} ref={feedback}>{state.error}</p>}
    {state.success && <p className="text-sm text-[var(--success)]" role="status">{state.success}</p>}
  </form>;
}
