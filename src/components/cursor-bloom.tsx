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
    let frame = 0,
      x = 0,
      y = 0;
    const move = (event: PointerEvent) => {
      if (!media.matches || event.pointerType !== "mouse") return;
      x = event.clientX;
      y = event.clientY;
      if (!frame)
        frame = requestAnimationFrame(() => {
          element.style.transform = `translate3d(${x - 22}px,${y - 22}px,0)`;
          element.style.opacity = ".4";
          frame = 0;
        });
    };
    const hide = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      element.style.opacity = "0";
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", hide);
    window.addEventListener("blur", hide);
    media.addEventListener("change", hide);
    return () => {
      hide();
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", hide);
      window.removeEventListener("blur", hide);
      media.removeEventListener("change", hide);
    };
  }, []);
  return <div className="cursor-bloom" aria-hidden="true" ref={bloom} />;
}
