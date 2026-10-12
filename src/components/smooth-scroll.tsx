"use client";

import { useEffect } from "react";
import Lenis from "@studio-freight/lenis";

/**
 * Transfers the buttery-smooth inertia scrolling from the welcome screen
 * across the entire website for all scrollable views.
 */
export function SmoothScroll() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    const lenis = new Lenis({
      lerp: 0.09,
      smoothWheel: true,
      syncTouch: false,
    });

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);
    const cancelOnFormInteraction = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest("form") &&
        lenis.isScrolling
      )
        lenis.scrollTo(lenis.actualScroll, { immediate: true });
    };
    document.addEventListener("pointerdown", cancelOnFormInteraction);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", cancelOnFormInteraction);
      lenis.destroy();
    };
  }, []);

  return null;
}
