"use client";
import Image from "next/image";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import type {
  InstallController,
  InstallSnapshot,
} from "@/lib/install-awareness";
import { installCopy } from "@/lib/install-copy";
import { useI18n } from "./locale-provider";

export function InstallGuide({
  state,
  controller,
}: {
  state: InstallSnapshot;
  controller: InstallController;
}) {
  const { locale } = useI18n(),
    t = installCopy(locale),
    id = useId(),
    dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current,
      opener =
        controller.guideOpener() ??
        (document.activeElement as HTMLElement | null),
      previous = document.body.style.overflow;
    element?.showModal();
    element
      ?.querySelector<HTMLButtonElement>(".install-close")
      ?.focus({ preventScroll: true });
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previous;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
      else {
        // A dismissed promotion disappears; return focus to the page, not the body.
        const heading = document.querySelector<HTMLElement>("main h1");
        if (heading) {
          const tab = heading.getAttribute("tabindex");
          heading.tabIndex = -1;
          heading.addEventListener(
            "blur",
            () => {
              if (tab === null) heading.removeAttribute("tabindex");
              else heading.setAttribute("tabindex", tab);
            },
            { once: true },
          );
          heading.focus({ preventScroll: true });
        }
      }
    };
  }, [controller]);
  const steps =
    state.platform === "ios-safari"
      ? t.ios
      : state.platform === "android-chrome"
        ? t.android
        : null;
  const note =
    state.platform === "ios-other"
      ? t.safariNote
      : state.platform === "android-other"
        ? t.androidNote
        : state.platform === "desktop"
          ? t.desktopNote
          : null;
  return createPortal(
    <dialog
      ref={dialog}
      className="install-guide"
      aria-labelledby={id}
      aria-describedby={id + "-description"}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)",
        );
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (
          first &&
          ((event.shiftKey && document.activeElement === first) ||
            (!event.shiftKey && document.activeElement === last))
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        controller.closeGuide();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const r = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < r.left ||
          event.clientX > r.right ||
          event.clientY < r.top ||
          event.clientY > r.bottom
        )
          controller.closeGuide();
      }}
    >
      <header className="install-guide-header">
        <Image
          src="/icons/icon-192.png"
          width={44}
          height={44}
          alt=""
          unoptimized
        />
        <h2 id={id}>{t.title}</h2>
        <button
          type="button"
          className="icon-button install-close"
          aria-label={t.close}
          onClick={() => controller.closeGuide()}
        >
          ×
        </button>
      </header>
      <p id={id + "-description"}>{t.body}</p>
      {state.nativeAvailable && (
        <button
          type="button"
          className="button install-native"
          disabled={state.busy}
          onClick={() => void controller.install()}
        >
          {state.busy ? t.busy : t.native}
        </button>
      )}
      {state.promptFailed && <p role="status">{t.failed}</p>}
      {note && <p className="install-browser-note">{note}</p>}
      {steps && (
        <>
          {state.nativeAvailable && (
            <p className="install-manual-label">{t.manual}</p>
          )}
          <ol>
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </>
      )}
    </dialog>,
    document.body,
  );
}
