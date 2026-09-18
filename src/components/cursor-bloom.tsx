"use client";

import { useEffect, useRef } from "react";

export function CursorBloom() {
  const bloom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = bloom.current;
    if (!element) return;

    const media = matchMedia(
      "(pointer: fine) and (prefers-reduced-motion: no-preference)",
    );

    let isVisible = false;
    let isHoveringInteractive = false;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch" || !media.matches) return;

      if (!isVisible) {
        isVisible = true;
      }

      // Check if mouse is hovering over an interactive target
      const target = event.target as HTMLElement | null;
      isHoveringInteractive = Boolean(
        target &&
          target.closest(
            'a, button, input, select, textarea, [role="button"], [role="tab"], .timetable-row, .card, .day-square-btn',
          ),
      );

      const baseRadius = 22;
      const scale = isHoveringInteractive ? 1.5 : 1.0;
      const opacity = isHoveringInteractive ? 0.6 : 0.38;

      element.style.transform = `translate3d(${event.clientX - baseRadius}px, ${event.clientY - baseRadius}px, 0) scale(${scale})`;
      element.style.opacity = String(opacity);
    };

    const handlePointerLeave = () => {
      isVisible = false;
      element.style.opacity = "0";
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("blur", handlePointerLeave);
    media.addEventListener("change", handlePointerLeave);

    return () => {
      handlePointerLeave();
      window.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("blur", handlePointerLeave);
      media.removeEventListener("change", handlePointerLeave);
    };
  }, []);

  return <div className="cursor-bloom" aria-hidden="true" ref={bloom} />;
}

