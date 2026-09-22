"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";

/** A viewport-positioned menu that never changes the surrounding layout. */
export function ActionMenu({
  label,
  children,
  icon,
}: {
  label: string;
  icon?: ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useCallback(() => {
    setOpen(false);
    document.getElementById(`${id}-trigger`)?.focus({ preventScroll: true });
  }, [id]);

  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      if (!panel.current || !trigger.current) return;
      const box = trigger.current.getBoundingClientRect();
      const menu = panel.current;
      const gap = 8;
      if (box.bottom < 0 || box.top > innerHeight) {
        setOpen(false);
        return;
      }
      menu.style.left = `${Math.max(gap, Math.min(box.right - menu.offsetWidth, innerWidth - menu.offsetWidth - gap))}px`;
      menu.style.top = `${Math.max(gap, box.bottom + menu.offsetHeight + gap < innerHeight ? box.bottom + gap : box.top - menu.offsetHeight - gap)}px`;
    };
    position();
    panel.current
      ?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')
      ?.focus({ preventScroll: true });
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        !panel.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("pointerdown", outside);
    };
  }, [open, close]);

  return (
    <>
      <button
        id={`${id}-trigger`}
        ref={trigger}
        type="button"
        className="icon-button action-menu-trigger"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {icon ?? <DotsHorizontalIcon aria-hidden="true"/>}
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="menu"
            aria-label={label}
            className="action-popover"
            onBlur={(event) => {
              if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node))
                setOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                close();
              }
              const items = Array.from(
                event.currentTarget.querySelectorAll<HTMLElement>(
                  '[role="menuitem"]:not(:disabled)',
                ),
              );
              const index = items.indexOf(
                document.activeElement as HTMLElement,
              );
              const next =
                event.key === "ArrowDown"
                  ? (index + 1) % items.length
                  : event.key === "ArrowUp"
                    ? (index - 1 + items.length) % items.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? items.length - 1
                        : null;
              if (next !== null) {
                event.preventDefault();
                items[next]?.focus();
              }
              if (event.key === "Tab") {
                event.preventDefault();
                close();
              }
            }}
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </>
  );
}
