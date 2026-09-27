"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "@studio-freight/lenis";
import { ArrowDown } from "lucide-react";
import { useI18n } from "@/components/locale-provider";

const ShaderBackground = dynamic(
  () => import("@/components/ui/shader-background"),
  { ssr: false }
);

type ParallaxProps = {
  title: string;
  subtitle: string;
  header: ReactNode;
  visual: ReactNode;
  children: ReactNode;
};

/**
 * Layered-scroll pattern adapted from the supplied
 * Osmo / 21st.dev example.
 */
export function ParallaxComponent({
  title,
  subtitle,
  header,
  visual,
  children,
}: ParallaxProps) {
  const root = useRef<HTMLDivElement>(null);
  const [showScrollCue, setShowScrollCue] = useState(false);
  const { locale } = useI18n();

  /**
   * Show the scroll cue only when the hero is almost fully visible
   * and the user has stayed there for 5 seconds.
   */
  useEffect(() => {
    const hero = root.current?.querySelector(".parallax__header");

    if (!hero) return;

    let timer: ReturnType<typeof setTimeout>;

    const observer = new IntersectionObserver(
      ([entry]) => {
        clearTimeout(timer);
        setShowScrollCue(false);

        if (entry.intersectionRatio >= 0.9) {
          timer = setTimeout(() => {
            setShowScrollCue(true);
          }, 5000);
        }
      },
      {
        threshold: [0, 0.9],
      }
    );

    observer.observe(hero);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  /**
   * Lenis + GSAP + ScrollTrigger parallax.
   */
  useEffect(() => {
    const element = root.current;

    if (!element) return;

    gsap.registerPlugin(ScrollTrigger);

    const media = gsap.matchMedia();

    media.add(
      "(prefers-reduced-motion: no-preference)",
      () => {
        const hero =
          element.querySelector<HTMLElement>(
            "[data-parallax-layers]"
          );

        const content =
          element.querySelector<HTMLElement>(
            ".parallax__content"
          );

        if (!hero || !content) return;

        /**
         * Preserve touch and keyboard scrolling.
         * Smooth only wheel input.
         */
        const lenis = new Lenis({
          lerp: 0.09,
          smoothWheel: true,
          syncTouch: false,
        });

        /**
         * GSAP ticker time is in seconds.
         * Lenis RAF expects milliseconds.
         */
        const tick = (time: number) => {
          lenis.raf(time * 1000);
        };

        /**
         * Keep ScrollTrigger and OpticalEnvironment
         * refraction in sync with Lenis smooth-scroll frames.
         *
         * IMPORTANT:
         * Never reuse the same Event instance here.
         * A fresh Event must be created for every dispatch.
         */
        let dispatchingScroll = false;
        const handleLenisScroll = () => {
          ScrollTrigger.update();

          if (dispatchingScroll) return;

          dispatchingScroll = true;
          try {
            window.dispatchEvent(
              new Event("scroll", {
                bubbles: true,
              })
            );
          } finally {
            dispatchingScroll = false;
          }
        };

        lenis.on("scroll", handleLenisScroll);
        gsap.ticker.add(tick);

        /**
         * Main hero parallax timeline.
         */
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: hero,
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });

        [85, 65, 35, -12].forEach(
          (yPercent, index) => {
            timeline.to(
              hero.querySelectorAll(
                `[data-parallax-layer="${index + 1}"]`
              ),
              {
                yPercent,
                ease: "none",
              },
              0
            );
          }
        );

        /**
         * Fade the welcome copy while scrolling.
         */
        timeline.to(
          hero.querySelector(".welcome-copy"),
          {
            opacity: 0,
            ease: "none",
          },
          0.15
        );

        /**
         * Tablet parallax.
         */
        timeline.to(
          hero.querySelector(
            ".welcome-hardware-tablet"
          ),
          {
            xPercent: -16,
            yPercent: 42,
            rotation: -5,
            ease: "none",
          },
          0
        );

        /**
         * Laptop parallax.
         */
        timeline.to(
          hero.querySelector(
            ".welcome-hardware-laptop"
          ),
          {
            yPercent: 14,
            ease: "none",
          },
          0
        );

        /**
         * Phone parallax.
         */
        timeline.to(
          hero.querySelector(
            ".welcome-hardware-phone"
          ),
          {
            xPercent: 20,
            yPercent: -30,
            rotation: 6,
            ease: "none",
          },
          0
        );

        /**
         * Pointer depth.
         *
         * Uses the individual CSS translate property,
         * keeping pointer transforms separate from
         * GSAP scroll transforms.
         */
        const hardware = [
          ...hero.querySelectorAll<HTMLElement>(
            ".welcome-hardware"
          ),
        ];

        const pointerMedia = window.matchMedia(
          "(hover: hover) and (pointer: fine)"
        );

        const move = (event: PointerEvent) => {
          if (!pointerMedia.matches) return;

          const rect =
            hero.getBoundingClientRect();

          if (
            rect.width === 0 ||
            rect.height === 0
          ) {
            return;
          }

          const x =
            (event.clientX - rect.left) /
              rect.width -
            0.5;

          const y =
            (event.clientY - rect.top) /
              rect.height -
            0.5;

          hardware.forEach(
            (device, index) => {
              const depth =
                [24, 10, 36][index] ?? 10;

              device.style.translate =
                `${x * depth}px ${y * depth}px`;
            }
          );
        };

        const resetPointer = () => {
          hardware.forEach((device) => {
            device.style.translate = "";
          });
        };

        hero.addEventListener(
          "pointermove",
          move
        );

        hero.addEventListener(
          "pointerleave",
          resetPointer
        );

        /**
         * The auth form remains real/selectable
         * content throughout the reveal.
         */
        gsap.from(
          content.querySelector(
            ".welcome-auth-panel"
          ),
          {
            y: 54,
            scale: 0.97,
            opacity: 0,
            ease: "none",

            scrollTrigger: {
              trigger: content,
              start: "top 95%",
              end: "top 35%",
              scrub: true,
            },
          }
        );

        /**
         * Smooth jump to authentication section.
         */
        const jumpToAuth = (
          event: MouseEvent
        ) => {
          const target =
            event.target instanceof Element
              ? event.target.closest<HTMLAnchorElement>(
                  'a[href="#welcome-auth"]'
                )
              : null;

          if (
            !target ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            event.button !== 0
          ) {
            return;
          }

          event.preventDefault();

          lenis.scrollTo(content, {
            duration: 1.1,

            onComplete: () => {
              content
                .querySelector<HTMLElement>(
                  "[role=tab][aria-selected=true]"
                )
                ?.focus({
                  preventScroll: true,
                });
            },
          });
        };

        element.addEventListener(
          "click",
          jumpToAuth
        );

        /**
         * Keyboard focus must never land
         * inside a partly faded form.
         */
        const revealOnFocus = (
          event: FocusEvent
        ) => {
          if (
            event.target instanceof Element &&
            event.target.matches(
              ":focus-visible"
            ) &&
            content.getBoundingClientRect()
              .top > 100
          ) {
            lenis.scrollTo(content, {
              immediate: true,
            });
          }
        };

        content.addEventListener(
          "focusin",
          revealOnFocus
        );

        /**
         * Stop an active smooth-scroll animation
         * when the user directly interacts with
         * the authentication content.
         */
        const cancelScrollOnInteraction =
          () => {
            if (lenis.isScrolling) {
              lenis.scrollTo(
                lenis.actualScroll,
                {
                  immediate: true,
                }
              );
            }
          };

        content.addEventListener(
          "pointerdown",
          cancelScrollOnInteraction
        );

        /**
         * Cleanup for this matchMedia context.
         */
        return () => {
          hero.removeEventListener(
            "pointermove",
            move
          );

          hero.removeEventListener(
            "pointerleave",
            resetPointer
          );

          resetPointer();

          element.removeEventListener(
            "click",
            jumpToAuth
          );

          content.removeEventListener(
            "focusin",
            revealOnFocus
          );

          content.removeEventListener(
            "pointerdown",
            cancelScrollOnInteraction
          );

          /**
           * Remove the Lenis listener BEFORE
           * destroying the Lenis instance.
           */
          lenis.off(
            "scroll",
            handleLenisScroll
          );

          gsap.ticker.remove(tick);

          lenis.destroy();
        };
      },
      element
    );

    /**
     * Revert only this component's GSAP
     * animation context, including ScrollTriggers.
     */
    return () => {
      media.revert();
    };
  }, []);

  return (
    <div
      className="public-experience welcome-screen parallax"
      ref={root}
    >
      {header}

      <main id="main">
        <section
          className="parallax__header"
          aria-labelledby="welcome-title"
          data-parallax-layers
        >
          <div
            className="welcome-atmosphere"
            aria-hidden="true"
          >
            <div
              className="welcome-ribbon welcome-ribbon-left"
              data-parallax-layer="1"
            />

            <div
              className="welcome-ribbon welcome-ribbon-right"
              data-parallax-layer="2"
            />

            <div className="welcome-floor" />
          </div>

          {showScrollCue && (
            <a
              className="welcome-scroll-cue"
              href="#welcome-auth"
            >
              {
                {
                  ru: "Листай вниз — начнём",
                  kk: "Төмен жылжыт — бастайық",
                  en: "Scroll down to begin",
                }[locale]
              }

              <span>
                <ArrowDown
                  size={17}
                  aria-hidden="true"
                />
              </span>
            </a>
          )}

          <div className="welcome-main">
            <div
              className="welcome-copy max-w-6xl"
              data-parallax-layer="3"
            >
              <h1 id="welcome-title">
                {title}
              </h1>

              <p>{subtitle}</p>
            </div>

            <div
              className="welcome-visual"
              data-parallax-layer="4"
            >
              {visual}
            </div>
          </div>
        </section>

        <section
          id="welcome-auth"
          className="parallax__content"
          aria-labelledby="welcome-auth-title"
        >
          <div
            className="welcome-auth-background"
            aria-hidden="true"
          >
            <ShaderBackground />
          </div>

          {children}
        </section>
      </main>
    </div>
  );
}
