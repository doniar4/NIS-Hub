"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useI18n } from "./locale-provider";
import { AppleSignIn } from "./apple-sign-in";
import { GoogleSignIn } from "./google-sign-in";

export function WelcomeAuth({
  signupForm,
  loginForm,
  configured,
  initialMode = "signup",
  confirmationFailed = false,
  callbackFailed = false,
  googleEnabled = false,
  appleEnabled = false,
  loginNext = "/",
}: {
  signupForm: ReactNode;
  loginForm: ReactNode;
  configured: boolean;
  initialMode?: "signup" | "login";
  confirmationFailed?: boolean;
  callbackFailed?: boolean;
  googleEnabled?: boolean;
  appleEnabled?: boolean;
  loginNext?: string;
}) {
  const [mode, setMode] = useState<"signup" | "login">(initialMode);
  const id = useId();
  const { t } = useI18n();
  const modeHref = (value: "signup" | "login") =>
    `/?auth=${value}${value === "login" ? "&next="+encodeURIComponent(loginNext) : ""}#welcome-auth`;
  function handleKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? "signup"
        : event.key === "End"
          ? "login"
          : mode === "signup"
            ? "login"
            : "signup";
    setMode(next);
    event.currentTarget
      .querySelector<HTMLElement>(`[data-mode="${next}"]`)
      ?.focus();
  }

  return (
    <div className="welcome-auth-panel">
      <div
        className="welcome-auth-tabs"
        role="tablist"
        aria-label={t.account}
        onKeyDown={handleKeys}
      >
        {(["signup", "login"] as const).map((value) => (
          <a
            href={modeHref(value)}
            role="tab"
            key={value}
            data-mode={value}
            id={`${id}-${value}-tab`}
            aria-controls={`${id}-${value}-panel`}
            aria-selected={mode === value}
            tabIndex={mode === value ? 0 : -1}
            onClick={(event) => {
              event.preventDefault();
              setMode(value);
            }}
          >
            {t[value]}
          </a>
        ))}
      </div>
      <h2 id="welcome-auth-title">{mode === "signup" ? t.signup : t.login}</h2>
      <p className="auth-subtitle">
        {mode === "signup" ? t.signupHint : t.loginHint}
      </p>
      {confirmationFailed && (
        <p className="form-error" role="alert">
          {t.confirmFailed}
        </p>
      )}
      {callbackFailed && (
        <p className="form-error" role="alert">
          {t.authLinkFailed}
        </p>
      )}
      {!configured && (
        <p className="notice" role="note">
          {t.authNotConfigured}
        </p>
      )}
      {(googleEnabled || appleEnabled) && (
        <div className="welcome-social-auth">
          {googleEnabled && <GoogleSignIn />}
          {appleEnabled && <AppleSignIn />}
          <p className="auth-divider">
            <span>{t.orEmail}</span>
          </p>
        </div>
      )}
      {(["signup", "login"] as const).map((value) => (
        <div
          key={value}
          role="tabpanel"
          id={`${id}-${value}-panel`}
          aria-labelledby={`${id}-${value}-tab`}
          hidden={mode !== value}
          className="welcome-auth-fields"
        >
          {value === "signup" ? signupForm : loginForm}
        </div>
      ))}
      <p className="auth-switch">
        {mode === "signup" ? t.hasAccount : t.noAccount}{" "}
        <a
          href={modeHref(mode === "signup" ? "login" : "signup")}
          onClick={(event) => {
            event.preventDefault();
            setMode(mode === "signup" ? "login" : "signup");
          }}
        >
          {mode === "signup" ? t.login : t.signup}
        </a>
      </p>
      <nav className="welcome-auth-legal" aria-label={t.account}>
        <Link href="/privacy">{t.privacy}</Link>
        <Link href="/terms">{t.terms}</Link>
      </nav>
    </div>
  );
}
