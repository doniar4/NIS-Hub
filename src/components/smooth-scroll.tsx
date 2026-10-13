"use client";
import { useEffect } from "react";
import Lenis from "@studio-freight/lenis";

/** Wheel inertia on desktops; native touch scrolling on phones and tablets. */
export function SmoothScroll() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let dispose = () => {};
    function sync() {
      dispose();
      dispose = () => {};
      if (reduced.matches || !pointer.matches) return;
      const lenis = new Lenis({ lerp: 0.12, smoothWheel: true, syncTouch: false });
      let frame = 0;
      const raf = (time: number) => { lenis.raf(time); frame = requestAnimationFrame(raf); };
      const visibility = () => {
        cancelAnimationFrame(frame);
        lenis.scrollTo(lenis.actualScroll, { immediate: true });
        if (!document.hidden) frame = requestAnimationFrame(raf);
      };
      const cancelOnInteraction = (event: PointerEvent) => {
        if (event.target instanceof Element && event.target.closest("form, dialog, [data-lenis-prevent]") && lenis.isScrolling)
          lenis.scrollTo(lenis.actualScroll, { immediate: true });
      };
      const modal = () => { if (document.querySelector("dialog:modal")) lenis.stop(); else lenis.start(); };
      const observer = new MutationObserver(modal);
      observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
      modal();
      frame = requestAnimationFrame(raf);
      document.addEventListener("pointerdown", cancelOnInteraction);
      document.addEventListener("visibilitychange", visibility);
      dispose = () => {
        cancelAnimationFrame(frame); observer.disconnect();
        document.removeEventListener("pointerdown", cancelOnInteraction);
        document.removeEventListener("visibilitychange", visibility);
        lenis.destroy();
      };
    }
    sync();
    reduced.addEventListener("change", sync); pointer.addEventListener("change", sync);
    return () => { dispose(); reduced.removeEventListener("change", sync); pointer.removeEventListener("change", sync); };
  }, []);
  return null;
}
