"use client";

import { useEffect, useRef } from "react";
import { BotanicalFlourish } from "./academic-art";

/**
 * ParallaxBackground:
 * Renders the exact organic botanical flourish patterns from the sidebar,
 * gliding subtly in the background layer with slow, inertial motion.
 */
export function ParallaxBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) return;

    const items = container.querySelectorAll<HTMLElement>(
      "[data-parallax-speed]",
    );
    if (!items.length) return;

    let targetScrollY = window.scrollY;
    let currentScrollY = window.scrollY;
    let targetPointerX = 0;
    let targetPointerY = 0;
    let currentPointerX = 0;
    let currentPointerY = 0;
    let rafId: number | null = null;
    let isRunning = false;
    let previousFrame = performance.now();

    const tick = (time = performance.now()) => {
      if (motion.matches) {
        isRunning = false;
        return;
      }
      const elapsed = Math.min(48, Math.max(0, time - previousFrame));
      previousFrame = time;
      const scrollEase = 1 - Math.exp(-elapsed / 210);
      const pointerEase = 1 - Math.exp(-elapsed / 260);
      const scrollDiff = targetScrollY - currentScrollY;
      const pointerDiffX = targetPointerX - currentPointerX;
      const pointerDiffY = targetPointerY - currentPointerY;

      // A long ease keeps quick wheel and trackpad gestures from snapping the artwork.
      currentScrollY += scrollDiff * scrollEase;
      currentPointerX += pointerDiffX * pointerEase;
      currentPointerY += pointerDiffY * pointerEase;

      items.forEach((item) => {
        const speed = parseFloat(item.dataset.parallaxSpeed || "0.08");
        const rotate = parseFloat(item.dataset.parallaxRotate || "0");
        const y = currentScrollY * speed;
        const depth = 2.75 + speed * 16;
        item.style.transform = `translate3d(${currentPointerX * depth}px, ${y + currentPointerY * depth}px, 0) rotate(${rotate}deg)`;
      });

      if (
        Math.abs(scrollDiff) > 0.1 ||
        Math.abs(pointerDiffX) > 0.003 ||
        Math.abs(pointerDiffY) > 0.003
      ) {
        rafId = requestAnimationFrame(tick);
      } else {
        isRunning = false;
      }
    };

    const onScroll = () => {
      if (motion.matches) return;
      targetScrollY = window.scrollY;
      schedule();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || motion.matches) return;
      targetPointerX = (event.clientX / window.innerWidth - 0.5) * 2;
      targetPointerY = (event.clientY / window.innerHeight - 0.5) * 2;
      schedule();
    };

    const schedule = () => {
      if (!isRunning) {
        isRunning = true;
        previousFrame = performance.now();
        rafId = requestAnimationFrame(tick);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    const onMotionChange = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      isRunning = false;
      if (motion.matches)
        items.forEach((item) => {
          item.style.transform = "";
        });
      else {
        targetScrollY = window.scrollY;
        currentScrollY = window.scrollY;
        schedule();
      }
    };
    motion.addEventListener("change", onMotionChange);
    tick();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
      motion.removeEventListener("change", onMotionChange);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div ref={containerRef} className="parallax-patterns" aria-hidden="true">
      <div
        className="parallax-pattern"
        data-parallax-speed="0.075"
        data-parallax-rotate="6"
        style={{
          right: "-5%",
          top: "3rem",
          width: "clamp(260px, 28vw, 440px)",
        }}
      >
        <BotanicalFlourish />
      </div>

      <div
        className="parallax-pattern"
        data-parallax-speed="0.055"
        data-parallax-rotate="-166"
        style={{
          left: "-7%",
          top: "40rem",
          width: "clamp(240px, 26vw, 420px)",
        }}
      >
        <BotanicalFlourish />
      </div>

      <div
        className="parallax-pattern"
        data-parallax-speed="0.09"
        data-parallax-rotate="12"
        style={{
          right: "-7%",
          top: "92rem",
          width: "clamp(270px, 29vw, 460px)",
        }}
      >
        <BotanicalFlourish />
      </div>
    </div>
  );
}
