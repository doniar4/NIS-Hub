"use client";

import {
  forwardRef,
  useRef,
  useImperativeHandle,
  type HTMLAttributes,
  type ButtonHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";
import { OpticalEnvironment } from "@/components/design/optical-environment";

export interface LiquidGlassViewportProps
  extends HTMLAttributes<HTMLDivElement> {
  bgImage: string;

  /**
   * webgl:
   * Creates a LOCAL OpticalEnvironment for this viewport.
   *
   * blur:
   * Does not activate WebGL refraction for this viewport.
   */
  fallbackMode?: "webgl" | "blur";

  /**
   * Set to false when the application already has
   * a global OpticalEnvironment mounted at the root.
   *
   * This prevents two WebGL environments from rendering
   * the same optical controls at the same time.
   *
   * Default: true for standalone usage.
   */
  renderEnvironment?: boolean;
}

export type LiquidGlassButtonProps =
  ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Standalone Liquid Glass viewport.
 *
 * IMPORTANT:
 *
 * If NIS-Hub already mounts <OpticalEnvironment /> globally
 * at the application root, use:
 *
 * <LiquidGlassViewport
 *   bgImage="..."
 *   renderEnvironment={false}
 * >
 *
 * Otherwise both the global and local optical engines may
 * attempt to render related surfaces simultaneously.
 */
export const LiquidGlassViewport =
  forwardRef<
    HTMLDivElement,
    LiquidGlassViewportProps
  >(
    (
      {
        bgImage,
        fallbackMode = "webgl",
        renderEnvironment = true,
        className,
        children,
        ...props
      },
      forwardedRef
    ) => {
      const scope =
        useRef<HTMLDivElement>(null);

      useImperativeHandle(
        forwardedRef,
        () => scope.current!,
        []
      );

      const shouldRenderEnvironment =
        renderEnvironment &&
        fallbackMode === "webgl";

      return (
        <div
          {...props}
          ref={scope}
          data-optical-scope
          className={cn(
            "optical-viewport",
            className
          )}
        >
          {shouldRenderEnvironment && (
            <OpticalEnvironment
              imageUrl={bgImage}
              scopeRef={scope}
              fallbackOnly={false}
            />
          )}

          {children}
        </div>
      );
    }
  );

LiquidGlassViewport.displayName =
  "LiquidGlassViewport";

/**
 * Refractive Liquid Glass button.
 *
 * The actual optical rendering is performed by
 * OpticalEnvironment.
 *
 * This component only marks itself as an optical
 * control using data-optical="control".
 */
export const LiquidGlassButton =
  forwardRef<
    HTMLButtonElement,
    LiquidGlassButtonProps
  >(
    (
      {
        className,
        children,
        type = "button",
        ...props
      },
      ref
    ) => {
      return (
        <button
          {...props}
          ref={ref}
          type={type}
          data-optical="control"
          className={cn(
            "button",
            "optical-button",
            className
          )}
        >
          {children}
        </button>
      );
    }
  );

LiquidGlassButton.displayName =
  "LiquidGlassButton";