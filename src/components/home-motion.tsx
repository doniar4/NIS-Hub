"use client";

import { useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useI18n } from "./locale-provider";
import { vintageCopy } from "@/lib/vintage-copy";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export function HomeMotion({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const { locale } = useI18n();
  const copy = vintageCopy(locale);

  useGSAP(() => {
    if (paused) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".hero-arrive", { opacity: 0, y: 12, duration: .85, stagger: .09, ease: "power2.out", clearProps: "all" });
      gsap.utils.toArray<HTMLElement>("[data-scroll-art]", scope.current).forEach(art => {
        gsap.timeline({ scrollTrigger: { trigger: art, start: "top 95%", end: "bottom top", scrub: 1 } })
          .fromTo(art, { scale: .8, opacity: .65 }, { scale: 1, opacity: 1, duration: .45, ease: "none" })
          .to(art, { scale: 1, opacity: 1, duration: .35 })
          .to(art, { opacity: .2, duration: .2, ease: "none" });
      });
      gsap.utils.toArray<HTMLElement>("[data-reveal-text]", scope.current).forEach(text => {
        gsap.from(text.querySelectorAll("span"), {
          opacity: .2, stagger: .12, ease: "none",
          scrollTrigger: { trigger: text, start: "top 90%", end: "top 60%", scrub: .7 },
        });
      });
    }, scope);
    // Async server content and accordion height changes can move scroll triggers.
    const observer = new ResizeObserver(() => ScrollTrigger.refresh());
    if (scope.current) observer.observe(scope.current);
    return () => { observer.disconnect(); media.revert(); };
  }, { scope, dependencies: [paused, locale], revertOnUpdate: true });

  return <div ref={scope} className="vintage-home" data-motion={paused ? "paused" : "playing"}>
    {children}
    <div className="motion-controls"><button type="button" className="motion-toggle" aria-pressed={paused} onClick={() => setPaused(value => !value)}>
      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">{paused ? <path d="m3 1 8 5-8 5Z" /> : <path d="M2 1h3v10H2zm5 0h3v10H7z" />}</svg>
      {paused ? copy.resume : copy.pause}
    </button></div>
  </div>;
}
