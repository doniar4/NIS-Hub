"use client";

import { useActionState } from "react";
import { startSocialSignIn } from "@/app/actions/auth";
import { useI18n } from "./locale-provider";

export function AppleSignIn() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(startSocialSignIn.bind(null, "apple"), {});
  return <form action={action} className="apple-sign-in">
    <button type="submit" disabled={pending} aria-busy={pending} className="apple-sign-in-button">
      <span className="apple-sign-in-icon" aria-hidden="true" />
      <span>{pending ? t.pending : t.continueWithApple}</span>
    </button>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
  </form>;
}
