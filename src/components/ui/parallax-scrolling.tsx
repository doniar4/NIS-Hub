"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "@studio-freight/lenis";
import { Pause, Play } from "lucide-react";
import { useI18n } from "@/components/locale-provider";

type ParallaxProps = {
  title: string;
  subtitle: string;
  header: ReactNode;
  visual: ReactNode;
  children: ReactNode;
};

/** Layered-scroll pattern adapted from the supplied Osmo / 21st.dev example. */
export function ParallaxComponent({ title, subtitle, header, visual, children }: ParallaxProps) {
  const root = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const element = root.current;
    if (!element || paused) return;
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();

    media.add("(prefers-reduced-motion: no-preference)", () => {
      const hero = element.querySelector<HTMLElement>("[data-parallax-layers]");
      const content = element.querySelector<HTMLElement>(".parallax__content");
      if (!hero || !content) return;

      // Preserve touch and keyboard scrolling; smooth only wheel input.
      const lenis = new Lenis({ lerp: 0.09, smoothWheel: true, syncTouch: false });
      const tick = (time: number) => lenis.raf(time * 1000);
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(tick);

      const timeline = gsap.timeline({
        scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
      });
      [70, 55, 40, 10].forEach((yPercent, index) => {
        timeline.to(hero.querySelectorAll(`[data-parallax-layer="${index + 1}"]`), {
          yPercent, ease: "none",
        }, 0);
      });
      timeline.to(hero.querySelector(".welcome-copy"), { opacity: 0, ease: "none" }, 0.15);

      // The form stays real, selectable content throughout the reveal.
      gsap.from(content.querySelector(".welcome-auth-panel"), {
        y: 54, scale: 0.97, opacity: 0,
        ease: "none",
        scrollTrigger: { trigger: content, start: "top 95%", end: "top 35%", scrub: true },
      });

      const jumpToAuth = (event: MouseEvent) => {
        const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href="#welcome-auth"]') : null;
        if (!target || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        lenis.scrollTo(content, { duration: 1.1, onComplete: () => {
          content.querySelector<HTMLElement>("[role=tab][aria-selected=true]")?.focus({ preventScroll: true });
        } });
      };
      element.addEventListener("click", jumpToAuth);

      // Keyboard focus must never land in a partly faded form.
      const revealOnFocus = (event: FocusEvent) => {
        // Pointer focus must not move the target between pointerdown and click.
        if (event.target instanceof Element && event.target.matches(":focus-visible") && content.getBoundingClientRect().top > 100) {
          lenis.scrollTo(content, { immediate: true });
        }
      };
      content.addEventListener("focusin", revealOnFocus);
      const cancelScrollOnInteraction = () => {
        if (lenis.isScrolling) lenis.scrollTo(lenis.actualScroll, { immediate: true });
      };
      content.addEventListener("pointerdown", cancelScrollOnInteraction);
      return () => {
        element.removeEventListener("click", jumpToAuth);
        content.removeEventListener("focusin", revealOnFocus);
        content.removeEventListener("pointerdown", cancelScrollOnInteraction);
        gsap.ticker.remove(tick);
        lenis.off("scroll", ScrollTrigger.update);
        lenis.destroy();
      };
    }, element);

    // Revert only this component's animation context, including its triggers.
    return () => media.revert();
  }, [paused]);

  return <div className="public-experience welcome-screen parallax" ref={root} data-motion-paused={paused}>
    {header}
    <main id="main">
      <section className="parallax__header" aria-labelledby="welcome-title" data-parallax-layers>
        <div className="welcome-atmosphere" aria-hidden="true">
          <div className="welcome-ribbon welcome-ribbon-left" data-parallax-layer="1" />
          <div className="welcome-ribbon welcome-ribbon-right" data-parallax-layer="2" />
          <div className="welcome-floor" />
        </div>
        <div className="welcome-main">
          <div className="welcome-copy max-w-6xl" data-parallax-layer="3">
            <h1 id="welcome-title">{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="welcome-visual" data-parallax-layer="4">{visual}</div>
        </div>
        <button className="welcome-motion-control" type="button" onClick={() => setPaused(!paused)}
          aria-label={paused ? t.resumeMotion : t.pauseMotion} title={paused ? t.resumeMotion : t.pauseMotion} aria-pressed={paused}>
          {paused ? <Play size={17} strokeWidth={1.5} aria-hidden="true" /> : <Pause size={17} strokeWidth={1.5} aria-hidden="true" />}
        </button>
      </section>
      <section id="welcome-auth" className="parallax__content" aria-labelledby="welcome-auth-title">
        {children}
      </section>
    </main>
  </div>;
}
