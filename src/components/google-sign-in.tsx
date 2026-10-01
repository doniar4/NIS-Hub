"use client";

import { useActionState } from "react";
import { startSocialSignIn } from "@/app/actions/auth";
import { useI18n } from "./locale-provider";

function GoogleMark() {
  return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" focusable="false">
    <path fill="#4285F4" d="M21.35 12.23c0-.76-.07-1.48-.19-2.18H12v4.12h5.23a4.47 4.47 0 0 1-1.94 2.94v2.44h3.14c1.84-1.7 2.92-4.2 2.92-7.32Z" />
    <path fill="#34A853" d="M12 21.5c2.63 0 4.84-.87 6.43-2.35l-3.14-2.44c-.87.59-1.98.94-3.29.94-2.53 0-4.68-1.71-5.45-4.01H3.31v2.52A9.72 9.72 0 0 0 12 21.5Z" />
    <path fill="#FBBC05" d="M6.55 13.64a5.84 5.84 0 0 1 0-3.28V7.84H3.31a9.73 9.73 0 0 0 0 8.32l3.24-2.52Z" />
    <path fill="#EA4335" d="M12 6.35c1.43 0 2.72.49 3.73 1.47l2.8-2.8A9.16 9.16 0 0 0 12 2.5a9.72 9.72 0 0 0-8.69 5.34l3.24 2.52c.77-2.3 2.92-4.01 5.45-4.01Z" />
  </svg>;
}

export function GoogleSignIn() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(startSocialSignIn.bind(null, "google"), {});
  return <form action={action} className="google-sign-in">
    <button type="submit" disabled={pending} aria-busy={pending} className="google-sign-in-button">
      <GoogleMark />
      <span>{pending ? t.pending : t.continueWithGoogle}</span>
    </button>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
  </form>;
}
