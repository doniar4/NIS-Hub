"use client";

import {useEffect} from "react";

const surfaces = "[data-material], .library-filters, .reader-controls, .action-popover, .notification-popover, .task-dialog";

/** Local optical highlight only: no tracking, storage, requests or React render loop. */
export function GlassLighting() {
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let active: HTMLElement | null = null;
    let frame = 0;
    let x = 0, y = 0;

    const clear = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      if (active) {
        active.style.removeProperty("--pointer-x");
        active.style.removeProperty("--pointer-y");
        delete active.dataset.glassLit;
        active = null;
      }
    };
    const move = (event: PointerEvent) => {
      if (motion.matches || !pointer.matches || event.pointerType === "touch") return;
      const next = event.target instanceof Element ? event.target.closest<HTMLElement>(surfaces) : null;
      if (next !== active) { clear(); active = next; }
      if (!active) return;
      x = event.clientX; y = event.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!active) return;
        const rect = active.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        active.style.setProperty("--pointer-x", Math.max(0, Math.min(100, (x - rect.left) / rect.width * 100)).toFixed(1) + "%");
        active.style.setProperty("--pointer-y", Math.max(0, Math.min(100, (y - rect.top) / rect.height * 100)).toFixed(1) + "%");
        active.dataset.glassLit = "true";
      });
    };
    const leave = (event: PointerEvent) => { if (!event.relatedTarget) clear(); };
    document.addEventListener("pointermove", move, {passive:true});
    document.addEventListener("pointerout", leave, {passive:true});
    window.addEventListener("blur", clear);
    window.addEventListener("scroll", clear, {passive:true, capture:true});
    motion.addEventListener("change", clear);
    pointer.addEventListener("change", clear);
    return () => {
      clear();
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerout", leave);
      window.removeEventListener("blur", clear);
      window.removeEventListener("scroll", clear, true);
      motion.removeEventListener("change", clear);
      pointer.removeEventListener("change", clear);
    };
  }, []);
  return null;
}
