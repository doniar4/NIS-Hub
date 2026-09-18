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
      // Apple HIG: Purposeful, brief, and fluid motion with spring-deceleration curve
      gsap.from(".hero-arrive", {
        opacity: 0,
        y: 14,
        duration: 0.65,
        stagger: 0.07,
        ease: "power3.out",
        clearProps: "transform,opacity",
      });

      gsap.utils.toArray<HTMLElement>("[data-scroll-art]", scope.current).forEach(art => {
        gsap.timeline({ scrollTrigger: { trigger: art, start: "top 95%", end: "bottom top", scrub: 0.8 } })
          .fromTo(art, { scale: .85, opacity: .7 }, { scale: 1, opacity: 1, duration: .45, ease: "power2.out" })
          .to(art, { scale: 1, opacity: 1, duration: .35 })
          .to(art, { opacity: .2, duration: .2, ease: "none" });
      });

      gsap.utils.toArray<HTMLElement>("[data-reveal-text]", scope.current).forEach(text => {
        gsap.from(text.querySelectorAll("span"), {
          opacity: .2,
          stagger: 0.08,
          ease: "none",
          scrollTrigger: { trigger: text, start: "top 90%", end: "top 60%", scrub: 0.6 },
        });
      });

      // Study desk panels (Timetable & Reading list)
      const panels = scope.current?.querySelector(".home-panels");
      if (panels) {
        gsap.from(".home-panel", {
          opacity: 0,
          y: 18,
          duration: 0.6,
          stagger: 0.08,
          ease: "power3.out",
          clearProps: "transform,opacity",
          scrollTrigger: {
            trigger: panels,
            start: "top 88%",
            toggleActions: "play none none none",
          },
        });
      }

      // Library invitation copy
      const invitation = scope.current?.querySelector(".library-invitation");
      if (invitation) {
        gsap.from(".invitation-copy", {
          opacity: 0,
          x: -16,
          duration: 0.65,
          ease: "power3.out",
          clearProps: "transform,opacity",
          scrollTrigger: {
            trigger: invitation,
            start: "top 82%",
            toggleActions: "play none none none",
          },
        });
      }

      // Learning routes cards
      const learning = scope.current?.querySelector(".learning-section");
      if (learning) {
        gsap.from(".study-route", {
          opacity: 0,
          y: 18,
          duration: 0.6,
          stagger: 0.08,
          ease: "power3.out",
          clearProps: "transform,opacity",
          scrollTrigger: {
            trigger: learning,
            start: "top 86%",
            toggleActions: "play none none none",
          },
        });
      }
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
