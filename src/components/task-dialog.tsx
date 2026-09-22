"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Cross2Icon } from "@radix-ui/react-icons";
import { communityCopy } from "@/lib/community-copy";
import { useI18n } from "./locale-provider";

gsap.registerPlugin(useGSAP);

export function TaskDialog({
  title,
  subtitle,
  onClose,
  children,
  busy = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  const id = useId();
  const { locale } = useI18n();
  const { contextSafe } = useGSAP(
    () => {
      const element = dialog.current;
      const opener = document.activeElement as HTMLElement | null;
      element?.showModal();
      element
        ?.querySelector<HTMLElement>("[data-dialog-autofocus]")
        ?.focus({ preventScroll: true });
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.fromTo(
          dialog.current,
          { opacity: 0, y: 10, scale: 0.97 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.28,
            ease: "power3.out",
            clearProps: "transform,opacity",
          },
        );
      }
      return () => {
        element?.close();
        if (opener?.isConnected) opener.focus({ preventScroll: true });
      };
    },
    { scope: dialog },
  );
  const dismiss = () => {
    contextSafe(() => {
      if (busy || closing.current) return;
      closing.current = true;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        onClose();
      else
        gsap.to(dialog.current, {
          opacity: 0,
          y: 10,
          duration: 0.16,
          ease: "power2.in",
          onComplete: onClose,
        });
    })();
  };
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialog}
      className="task-dialog"
      aria-labelledby={id}
      aria-describedby={subtitle ? `${id}-description` : undefined}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          dismiss();
      }}
    >
      <header className="task-dialog-heading">
        <div>
          <h2 id={id}>{title}</h2>
          {subtitle && <p id={`${id}-description`}>{subtitle}</p>}
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label={communityCopy(locale).close}
          disabled={busy}
          onClick={dismiss}
        >
          <Cross2Icon />
        </button>
      </header>
      {children}
    </dialog>,
    document.body,
  );
}
