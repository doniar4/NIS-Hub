"use client";

import { useEffect, useRef } from "react";
import { BotanicalFlourish } from "./academic-art";

/**
 * ParallaxBackground:
 * Renders the exact organic botanical flourish patterns from the sidebar,
 * gliding smoothly in the background layer with Apple-grade fluid inertial physics.
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

    const tick = () => {
      if (motion.matches) {
        isRunning = false;
        return;
      }
      const diff = targetScrollY - currentScrollY;
      currentScrollY += diff * 0.27;
      currentPointerX += (targetPointerX - currentPointerX) * 0.2;
      currentPointerY += (targetPointerY - currentPointerY) * 0.2;

      items.forEach((item) => {
        const speed = parseFloat(item.dataset.parallaxSpeed || "0.62");
        const rotate = parseFloat(item.dataset.parallaxRotate || "0");
        const y = currentScrollY * speed;
        const depth = speed * 11;
        item.style.transform = `translate3d(${currentPointerX * depth}px, ${y + currentPointerY * depth}px, 0) rotate(${rotate}deg)`;
      });

      if (
        Math.abs(diff) > 0.15 ||
        Math.abs(targetPointerX - currentPointerX) > 0.005 ||
        Math.abs(targetPointerY - currentPointerY) > 0.005
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
        data-parallax-speed="0.62"
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
        data-parallax-speed="0.55"
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
        data-parallax-speed="0.68"
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
