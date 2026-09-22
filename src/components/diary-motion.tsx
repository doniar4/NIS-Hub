"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export function DiaryMotion({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-diary-arrive]", {
          autoAlpha: 0,
          y: 10,
          duration: 0.34,
          stagger: 0.07,
          ease: "power3.out",
          clearProps: "transform,opacity,visibility",
        });

        const cards = gsap.utils.toArray<HTMLElement>(
          "[data-diary-card]",
          scope.current,
        );
        cards.forEach((card, index) => {
          gsap.from(card, {
            autoAlpha: 0,
            y: 10,
            scale: 0.99,
            duration: 0.36,
            delay: Math.min(index * 0.045, 0.24),
            ease: "power3.out",
            clearProps: "transform,opacity,visibility",
            scrollTrigger: {
              trigger: card,
              start: "top 94%",
              once: true,
            },
          });
        });

        gsap.utils
          .toArray<HTMLElement>("[data-diary-motif]", scope.current)
          .forEach((motif) => {
            gsap.fromTo(
              motif,
              { scale: 0.88, opacity: 0.38 },
              {
                scale: 1,
                opacity: 1,
                ease: "none",
                scrollTrigger: {
                  trigger: motif,
                  start: "top 96%",
                  end: "top 68%",
                  scrub: 0.55,
                },
              },
            );
          });
      }, scope);

      const observer = new ResizeObserver(() => ScrollTrigger.refresh());
      if (scope.current) observer.observe(scope.current);
      return () => {
        observer.disconnect();
        media.revert();
      };
    },
    { scope },
  );

  return <div ref={scope}>{children}</div>;
}
