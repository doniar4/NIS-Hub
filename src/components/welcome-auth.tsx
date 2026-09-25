"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useI18n } from "./locale-provider";

export function WelcomeAuth({ signupForm, loginForm, configured }: {
  signupForm: ReactNode;
  loginForm: ReactNode;
  configured: boolean;
}) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const id = useId();
  const { t } = useI18n();
  function handleKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "signup" : event.key === "End" ? "login" : mode === "signup" ? "login" : "signup";
    setMode(next);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-mode="${next}"]`)?.focus();
  }

  return <div className="welcome-auth-panel">
    <div className="welcome-auth-tabs" role="tablist" aria-label={t.account} onKeyDown={handleKeys}>
      {(["signup", "login"] as const).map(value => <button type="button" role="tab" key={value} data-mode={value}
        id={`${id}-${value}-tab`} aria-controls={`${id}-${value}-panel`} aria-selected={mode === value}
        tabIndex={mode === value ? 0 : -1} onClick={() => setMode(value)}>{t[value]}</button>)}
    </div>
    <h2 id="welcome-auth-title">{mode === "signup" ? t.signup : t.login}</h2>
    <p className="auth-subtitle">{mode === "signup" ? t.signupHint : t.loginHint}</p>
    {!configured && <p className="notice" role="note">{t.authNotConfigured}</p>}
    {(["signup", "login"] as const).map(value => <div key={value} role="tabpanel" id={`${id}-${value}-panel`}
      aria-labelledby={`${id}-${value}-tab`} hidden={mode !== value} className="welcome-auth-fields">
      {value === "signup" ? signupForm : loginForm}
    </div>)}
    <p className="auth-switch">{mode === "signup" ? t.hasAccount : t.noAccount}{" "}
      <button type="button" onClick={() => setMode(mode === "signup" ? "login" : "signup")}>{mode === "signup" ? t.login : t.signup}</button>
    </p>
    <nav className="welcome-auth-legal" aria-label={t.account}>
      <Link href="/privacy">{t.privacy}</Link><Link href="/terms">{t.terms}</Link>
    </nav>
  </div>;
}
