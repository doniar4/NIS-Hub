"use client";

import {
  useEffect,
  useRef,
  type RefObject,
  type CSSProperties,
} from "react";

export const NATURE_IMAGE = "/images/nature-lake.webp";

/**
 * Existing semantic primitives participate without changing
 * their data or event handlers.
 */
export const OPTICAL_SURFACES = [
  "[data-optical]",
  ".glass-surface",
  ".surface-card",
  ".empty-state",
  ".dashboard-card",
  ".library-card",
  ".welcome-auth-panel",
  ".app-sidebar",
  ".global-search",
  ".library-filters",
  ".selected-lesson",
  ".profile-reading > section",
  ".sms-toolbar",
  ".sms-subject",
  ".sms-connect-shell",
  ".sms-privacy-panel",
  ".diary-overview",
  ".diary-import",
  ".schedule-lessons",
  ".reader-controls",
  ".reader-inspector",
  ".mobile-drawer",
  ".task-dialog",
  ".notification-popover",
  ".action-popover",
  ".auth-form-inner",
  ".legal-prose",
  ".button",
  ".icon-button",
  ".notification-trigger",
  ".sidebar-collapse",
  ".theme-switch",
  ".public-locale-options",
  ".welcome-scroll-cue",
  ".ai-study-action-btn",
  ".ai-generate-button",
  ".flame-button",
].join(",");

/* -------------------------------------------------------------------------- */
/*                                WEBGL SHADERS                               */
/* -------------------------------------------------------------------------- */

const vertex = `
attribute vec2 position;

void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `
precision highp float;

uniform sampler2D scene;

uniform vec2 resolution;
uniform vec2 viewport;
uniform vec2 imageSize;

uniform vec4 lens;

uniform float radius;
uniform float strength;
uniform float softness;
uniform float enabled;

/**
 * Samples the original nature environment using the same
 * background-cover geometry as the page.
 */
vec3 sampleScene(vec2 point) {
  float cover = max(
    viewport.x / imageSize.x,
    viewport.y / imageSize.y
  );

  vec2 size = imageSize * cover;

  vec2 uv =
    (point + (size - viewport) * 0.5) /
    size;

  vec3 photo = texture2D(
    scene,
    clamp(uv, 0.0, 1.0)
  ).rgb;

  return mix(
    photo,
    vec3(0.97, 0.98, 1.0),
    0.10
  );
}

void main() {
  vec2 point =
    vec2(
      gl_FragCoord.x / resolution.x,
      1.0 - gl_FragCoord.y / resolution.y
    ) * viewport;

  /**
   * Safety mode.
   *
   * Normally the production renderer only draws while
   * enabled == 1.0.
   */
  if (enabled < 0.5) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec2 center =
    lens.xy +
    lens.zw * 0.5;

  vec2 local =
    point - center;

  /**
   * Rounded rectangle signed-distance field.
   */
  vec2 q =
    abs(local) -
    lens.zw * 0.5 +
    radius;

  float distance =
    length(max(q, 0.0)) +
    min(max(q.x, q.y), 0.0) -
    radius;

  /**
   * Everything outside the actual optical surface remains
   * transparent.
   */
  if (distance > 0.0) {
    discard;
  }

  /**
   * Approximate outward surface normal.
   */
  vec2 normal =
    q.x > q.y
      ? vec2(sign(local.x), 0.0)
      : vec2(0.0, sign(local.y));

  if (
    q.x > 0.0 &&
    q.y > 0.0
  ) {
    normal =
      normalize(
        max(q, 0.0) *
        sign(local)
      );
  }

  float rim =
    min(
      46.0,
      min(lens.z, lens.w) * 0.32
    );

  float depth =
    -distance;

  float convex =
    exp(
      -depth /
      max(rim * 0.52, 1.0)
    );

  /**
   * Convex optical lens.
   *
   * Compresses the scene toward the rim while maintaining
   * subtle magnification toward the interior.
   */
  vec2 displaced =
    center +
    local * 0.985 -
    normal * strength * convex;

  /**
   * Small optical softness.
   */
  vec2 blur =
    vec2(
      softness *
      (1.0 - convex * 0.65)
    );

  vec3 color =
    sampleScene(displaced) * 0.4;

  color +=
    sampleScene(
      displaced +
      vec2(blur.x, 0.0)
    ) * 0.15;

  color +=
    sampleScene(
      displaced -
      vec2(blur.x, 0.0)
    ) * 0.15;

  color +=
    sampleScene(
      displaced +
      vec2(0.0, blur.y)
    ) * 0.15;

  color +=
    sampleScene(
      displaced -
      vec2(0.0, blur.y)
    ) * 0.15;

  /**
   * Directional glass illumination.
   */
  float lighting =
    dot(
      normal,
      normalize(
        vec2(-0.45, -0.85)
      )
    );

  color +=
    lighting *
    convex *
    0.10;

  gl_FragColor =
    vec4(
      color,
      1.0
    );
}
`;

/* -------------------------------------------------------------------------- */
/*                           OPTICAL ENVIRONMENT                              */
/* -------------------------------------------------------------------------- */

/**
 * One shared demand-rendered optical scene.
 *
 * The WebGL canvas is TRANSPARENT everywhere except inside
 * active optical surfaces.
 *
 * It never captures text, documents or user data.
 */
export function OpticalEnvironment({
  imageUrl = NATURE_IMAGE,
  scopeRef,
  fallbackOnly = false,
}: {
  imageUrl?: string;
  scopeRef?: RefObject<HTMLDivElement | null>;
  fallbackOnly?: boolean;
}) {
  const canvasRef =
    useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return;
    }

    const root =
      document.documentElement;

    const reduced =
      matchMedia(
        "(prefers-reduced-transparency: reduce)"
      );

    const motion =
      matchMedia(
        "(prefers-reduced-motion: reduce)"
      );

    let disposeRenderer:
      | (() => void)
      | undefined;

    /* ---------------------------------------------------------------------- */
    /*                              START RENDERER                             */
    /* ---------------------------------------------------------------------- */

    const start = () => {
      /**
       * Destroy any previous renderer before creating another one.
       */
      disposeRenderer?.();
      disposeRenderer = undefined;

      canvas.dataset.ready = "false";

      if (
        root.dataset.theme === "dark" ||
        reduced.matches ||
        fallbackOnly
      ) {
        return;
      }

      /**
       * IMPORTANT:
       *
       * alpha MUST be true.
       *
       * The canvas should be transparent everywhere except
       * inside refractive surfaces.
       */
      const gl =
        canvas.getContext(
          "webgl",
          {
            alpha: true,
            antialias: false,
            premultipliedAlpha: true,
            powerPreference: "low-power",
          }
        );

      if (!gl) {
        return;
      }

      const program =
        gl.createProgram();

      const buffer =
        gl.createBuffer();

      const texture =
        gl.createTexture();

      const shaders:
        WebGLShader[] = [];

      /**
       * Release GPU resources.
       */
      const release = () => {
        shaders.forEach(
          (shader) =>
            gl.deleteShader(shader)
        );

        if (program) {
          gl.deleteProgram(program);
        }

        if (buffer) {
          gl.deleteBuffer(buffer);
        }

        if (texture) {
          gl.deleteTexture(texture);
        }
      };

      if (
        !program ||
        !buffer ||
        !texture
      ) {
        release();
        return;
      }

      /* -------------------------------------------------------------------- */
      /*                              COMPILE SHADERS                           */
      /* -------------------------------------------------------------------- */

      for (
        const [type, source] of [
          [gl.VERTEX_SHADER, vertex],
          [gl.FRAGMENT_SHADER, fragment],
        ] as const
      ) {
        const shader =
          gl.createShader(type);

        if (!shader) {
          release();
          return;
        }

        shaders.push(shader);

        gl.shaderSource(
          shader,
          source
        );

        gl.compileShader(shader);

        if (
          !gl.getShaderParameter(
            shader,
            gl.COMPILE_STATUS
          )
        ) {
          console.error(
            "OpticalEnvironment shader compilation failed:",
            gl.getShaderInfoLog(shader)
          );

          release();
          return;
        }

        gl.attachShader(
          program,
          shader
        );
      }

      /* -------------------------------------------------------------------- */
      /*                               LINK PROGRAM                            */
      /* -------------------------------------------------------------------- */

      gl.linkProgram(program);

      if (
        !gl.getProgramParameter(
          program,
          gl.LINK_STATUS
        )
      ) {
        console.error(
          "OpticalEnvironment WebGL program linking failed:",
          gl.getProgramInfoLog(program)
        );

        release();
        return;
      }

      gl.useProgram(program);

      /* -------------------------------------------------------------------- */
      /*                              SCREEN QUAD                              */
      /* -------------------------------------------------------------------- */

      gl.bindBuffer(
        gl.ARRAY_BUFFER,
        buffer
      );

      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
          -1,
          -1,

          1,
          -1,

          -1,
          1,

          1,
          1,
        ]),
        gl.STATIC_DRAW
      );

      const position =
        gl.getAttribLocation(
          program,
          "position"
        );

      gl.enableVertexAttribArray(
        position
      );

      gl.vertexAttribPointer(
        position,
        2,
        gl.FLOAT,
        false,
        0,
        0
      );

      /* -------------------------------------------------------------------- */
      /*                                UNIFORMS                               */
      /* -------------------------------------------------------------------- */

      const uniforms =
        Object.fromEntries(
          [
            "scene",
            "resolution",
            "viewport",
            "imageSize",
            "lens",
            "radius",
            "strength",
            "softness",
            "enabled",
          ].map(
            (key) => [
              key,
              gl.getUniformLocation(
                program,
                key
              ),
            ]
          )
        );

      /* -------------------------------------------------------------------- */
      /*                                TEXTURE                                */
      /* -------------------------------------------------------------------- */

      gl.activeTexture(
        gl.TEXTURE0
      );

      gl.bindTexture(
        gl.TEXTURE_2D,
        texture
      );

      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_S,
        gl.CLAMP_TO_EDGE
      );

      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_T,
        gl.CLAMP_TO_EDGE
      );

      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR
      );

      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MAG_FILTER,
        gl.LINEAR
      );

      /* -------------------------------------------------------------------- */
      /*                              RENDER STATE                             */
      /* -------------------------------------------------------------------- */

      let stopped = false;
      let loaded = false;
      let image: HTMLImageElement | undefined;
      let frame = 0;
      let until = 0;
      let needsScan = true;

      let surfaces:
        HTMLElement[] = [];

      const visible =
        new Set<Element>();

      /* -------------------------------------------------------------------- */
      /*                         INTERSECTION OBSERVER                          */
      /* -------------------------------------------------------------------- */

      const intersection =
        new IntersectionObserver(
          (entries) => {
            for (
              const entry of entries
            ) {
              if (
                entry.isIntersecting
              ) {
                visible.add(
                  entry.target
                );
              } else {
                visible.delete(
                  entry.target
                );
              }
            }

            schedule();
          },
          {
            rootMargin: "80px",
          }
        );

      /* -------------------------------------------------------------------- */
      /*                            RESIZE OBSERVER                             */
      /* -------------------------------------------------------------------- */

      const resize =
        new ResizeObserver(() => {
          schedule();
        });

      /* -------------------------------------------------------------------- */
      /*                              SURFACE SCAN                              */
      /* -------------------------------------------------------------------- */

      const scan = () => {
        const scope =
          scopeRef?.current ??
          document;

        const next = [
          ...scope.querySelectorAll<HTMLElement>(
            OPTICAL_SURFACES
          ),
        ].filter(
          (el) =>
            !el.closest(
              "[data-optical-exclude]"
            ) &&
            (
              scopeRef ||
              !el.closest(
                "[data-optical-scope]"
              )
            )
        );

        /**
         * Remove old surfaces.
         */
        for (
          const el of surfaces
        ) {
          if (
            !next.includes(el)
          ) {
            intersection.unobserve(
              el
            );

            resize.unobserve(el);

            visible.delete(el);
          }
        }

        /**
         * Observe new surfaces.
         */
        for (
          const el of next
        ) {
          if (
            !surfaces.includes(el)
          ) {
            intersection.observe(
              el
            );

            resize.observe(el);
          }
        }

        surfaces = next;
        needsScan = false;
      };

      /* -------------------------------------------------------------------- */
      /*                         ANCESTOR CLIPPING                             */
      /* -------------------------------------------------------------------- */

      /**
       * Returns the visible clipping bounds for an optical surface in the
       * canvas' CSS-pixel coordinate space.
       *
       * The shader still receives the element's ORIGINAL rectangle. These
       * bounds are used only by gl.scissor(), so partially clipped lenses do
       * not change shape while scrolling behind overflow containers.
       */
      const getClipBounds = (
        element: HTMLElement,
        origin: DOMRect,
        viewportWidth: number,
        viewportHeight: number
      ) => {
        let left = 0;
        let top = 0;
        let right = viewportWidth;
        let bottom = viewportHeight;

        let parent =
          element.parentElement;

        while (parent) {
          const style =
            getComputedStyle(parent);

          const clipsX =
            style.overflowX === "hidden" ||
            style.overflowX === "clip" ||
            style.overflowX === "auto" ||
            style.overflowX === "scroll";

          const clipsY =
            style.overflowY === "hidden" ||
            style.overflowY === "clip" ||
            style.overflowY === "auto" ||
            style.overflowY === "scroll";

          if (clipsX || clipsY) {
            const parentRect =
              parent.getBoundingClientRect();

            const parentLeft =
              parentRect.left -
              origin.left;

            const parentTop =
              parentRect.top -
              origin.top;

            const parentRight =
              parentRect.right -
              origin.left;

            const parentBottom =
              parentRect.bottom -
              origin.top;

            if (clipsX) {
              left =
                Math.max(
                  left,
                  parentLeft
                );

              right =
                Math.min(
                  right,
                  parentRight
                );
            }

            if (clipsY) {
              top =
                Math.max(
                  top,
                  parentTop
                );

              bottom =
                Math.min(
                  bottom,
                  parentBottom
                );
            }
          }

          parent =
            parent.parentElement;
        }

        return {
          left,
          top,
          right,
          bottom,
        };
      };

      /* -------------------------------------------------------------------- */
      /*                                  RENDER                               */
      /* -------------------------------------------------------------------- */

      const render = () => {
        frame = 0;

        if (
          stopped ||
          !loaded ||
          document.hidden
        ) {
          return;
        }

        if (needsScan) {
          scan();
        }

        const width =
          canvas.clientWidth;

        const height =
          canvas.clientHeight;

        /**
         * Position of the WebGL canvas in viewport coordinates.
         */
        const origin =
          canvas.getBoundingClientRect();

        if (
          width <= 0 ||
          height <= 0
        ) {
          return;
        }

        /**
         * Limit DPR to avoid excessive GPU load.
         */
        const dpr =
          Math.min(
            window.devicePixelRatio ||
              1,
            1.5
          );

        const w =
          Math.max(
            1,
            Math.round(
              width * dpr
            )
          );

        const h =
          Math.max(
            1,
            Math.round(
              height * dpr
            )
          );

        /**
         * Update backing resolution only when necessary.
         */
        if (
          canvas.width !== w ||
          canvas.height !== h
        ) {
          canvas.width = w;
          canvas.height = h;
        }

        gl.viewport(
          0,
          0,
          w,
          h
        );

        gl.uniform2f(
          uniforms.resolution,
          w,
          h
        );

        gl.uniform2f(
          uniforms.viewport,
          width,
          height
        );

        /**
         * CRITICAL FIX:
         *
         * Clear the complete WebGL canvas to transparent.
         *
         * DO NOT draw the nature background fullscreen here.
         *
         * The real nature environment already exists behind
         * the canvas.
         *
         * WebGL should only draw refracted copies INSIDE
         * actual optical surfaces.
         */
        gl.disable(
          gl.SCISSOR_TEST
        );

        gl.clearColor(
          0,
          0,
          0,
          0
        );

        gl.clear(
          gl.COLOR_BUFFER_BIT
        );

        /**
         * From this point onward, drawing is restricted to
         * individual optical surfaces.
         */
        gl.enable(
          gl.SCISSOR_TEST
        );

        gl.uniform1f(
          uniforms.enabled,
          1
        );

        /* ------------------------------------------------------------------ */
        /*                         READ SURFACE GEOMETRY                        */
        /* ------------------------------------------------------------------ */

        /**
         * Batch DOM geometry reads before WebGL drawing.
         */
        const geometry =
          surfaces
            .filter(
              (el) =>
                visible.has(el) &&
                el.isConnected &&
                el.checkVisibility()
            )
            .map((el) => {
              const rect =
                el.getBoundingClientRect();

              const style =
                getComputedStyle(el);

              const control =
                el.matches(
                  [
                    "button",
                    "a",
                    ".theme-switch",
                    ".public-locale-options",
                    ".global-search",
                  ].join(",")
                );

              const positioned = {
                left:
                  rect.left -
                  origin.left,

                top:
                  rect.top -
                  origin.top,

                right:
                  rect.right -
                  origin.left,

                bottom:
                  rect.bottom -
                  origin.top,

                width:
                  rect.width,

                height:
                  rect.height,
              };

              const clip =
                getClipBounds(
                  el,
                  origin,
                  width,
                  height
                );

              const parsedRadius =
                parseFloat(
                  style.borderTopLeftRadius
                ) || 20;

              const radius =
                Math.min(
                  parsedRadius,
                  rect.height / 2,
                  rect.width / 2
                );

              return {
                rect: positioned,
                clip,
                radius,
                control,
              };
            });

        /* ------------------------------------------------------------------ */
        /*                       DRAW OPTICAL SURFACES                          */
        /* ------------------------------------------------------------------ */

        for (
          const {
            rect,
            clip,
            radius,
            control,
          } of geometry
        ) {
          /**
           * Ignore invalid surfaces.
           */
          if (
            rect.width < 1 ||
            rect.height < 1
          ) {
            continue;
          }

          /**
           * IMPORTANT:
           *
           * Completely skip elements outside the WebGL canvas.
           *
           * This prevents "floating" ghost glass after
           * scrolling past the original controls.
           */
          if (
            rect.right <= 0 ||
            rect.left >= width ||
            rect.bottom <= 0 ||
            rect.top >= height
          ) {
            continue;
          }

          /**
           * Intersect the optical surface with both the WebGL canvas and every
           * clipping ancestor. This is what prevents refraction from remaining
           * visible after the real DOM control has scrolled behind a clipped
           * header/panel.
           */
          const clippedLeft =
            Math.max(
              0,
              rect.left,
              clip.left
            );

          const clippedTop =
            Math.max(
              0,
              rect.top,
              clip.top
            );

          const clippedRight =
            Math.min(
              width,
              rect.right,
              clip.right
            );

          const clippedBottom =
            Math.min(
              height,
              rect.bottom,
              clip.bottom
            );

          if (
            clippedRight <= clippedLeft ||
            clippedBottom <= clippedTop
          ) {
            continue;
          }

          /**
           * Convert the CLIPPED CSS coordinates into WebGL scissor
           * coordinates. The lens uniform below deliberately keeps the
           * ORIGINAL element rectangle.
           */
          const left =
            Math.max(
              0,
              Math.floor(
                clippedLeft * dpr
              )
            );

          const bottom =
            Math.max(
              0,
              Math.floor(
                (
                  height -
                  clippedBottom
                ) * dpr
              )
            );

          const right =
            Math.min(
              w,
              Math.ceil(
                clippedRight * dpr
              )
            );

          const top =
            Math.min(
              h,
              Math.ceil(
                (
                  height -
                  clippedTop
                ) * dpr
              )
            );

          if (
            right <= left ||
            top <= bottom
          ) {
            continue;
          }

          /**
           * Clip WebGL drawing to this surface's bounding box.
           */
          gl.scissor(
            left,
            bottom,
            right - left,
            top - bottom
          );

          /**
           * Send the surface geometry to the shader.
           */
          gl.uniform4f(
            uniforms.lens,
            rect.left,
            rect.top,
            rect.width,
            rect.height
          );

          gl.uniform1f(
            uniforms.radius,
            radius
          );

          /**
           * Smaller controls use slightly less aggressive
           * displacement.
           */
          gl.uniform1f(
            uniforms.strength,
            control
              ? 18
              : 30
          );

          gl.uniform1f(
            uniforms.softness,
            control
              ? 1
              : 2.4
          );

          gl.drawArrays(
            gl.TRIANGLE_STRIP,
            0,
            4
          );
        }

        gl.disable(
          gl.SCISSOR_TEST
        );

        canvas.dataset.ready =
          "true";

        /**
         * Keep rendering briefly during transitions and
         * interactions.
         */
        if (
          performance.now() <
            until &&
          !motion.matches
        ) {
          schedule();
        }
      };

      /* -------------------------------------------------------------------- */
      /*                               SCHEDULER                               */
      /* -------------------------------------------------------------------- */

      function schedule() {
        if (
          !frame &&
          !stopped &&
          !document.hidden
        ) {
          frame =
            requestAnimationFrame(
              render
            );
        }
      }

      /* -------------------------------------------------------------------- */
      /*                              DOM CHANGES                              */
      /* -------------------------------------------------------------------- */

      const changed = () => {
        needsScan = true;

        until =
          performance.now() +
          480;

        schedule();
      };

      const mutations =
        new MutationObserver(
          changed
        );

      mutations.observe(
        scopeRef?.current ??
          document.body,
        {
          childList: true,
          subtree: true,
        }
      );

      /* -------------------------------------------------------------------- */
      /*                            ROOT ATTRIBUTES                             */
      /* -------------------------------------------------------------------- */

      const attributes =
        new MutationObserver(
          changed
        );

      attributes.observe(
        root,
        {
          attributes: true,
          attributeFilter: [
            "data-sidebar",
          ],
        }
      );

      /* -------------------------------------------------------------------- */
      /*                              INTERACTION                              */
      /* -------------------------------------------------------------------- */

      const interaction = () => {
        until =
          performance.now() +
          480;

        schedule();
      };

      /* -------------------------------------------------------------------- */
      /*                               LOAD IMAGE                              */
      /* -------------------------------------------------------------------- */

      if (imageUrl) {
        image = new Image();

        image.onload = () => {
          if (stopped || !image) {
            return;
          }

          gl.bindTexture(
            gl.TEXTURE_2D,
            texture
          );

          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            image
          );

          gl.uniform1i(
            uniforms.scene,
            0
          );

          gl.uniform2f(
            uniforms.imageSize,
            image.naturalWidth,
            image.naturalHeight
          );

          loaded = true;

          schedule();
        };

        image.onerror = () => {
          console.error(
            `OpticalEnvironment failed to load image: ${imageUrl}`
          );
        };

        image.crossOrigin =
          "anonymous";

        image.src =
          imageUrl;
      } else {
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          1,
          1,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          new Uint8Array([232, 237, 243, 255])
        );

        gl.uniform1i(
          uniforms.scene,
          0
        );

        gl.uniform2f(
          uniforms.imageSize,
          1,
          1
        );

        loaded = true;

        schedule();
      }

      /* -------------------------------------------------------------------- */
      /*                               OBSERVERS                               */
      /* -------------------------------------------------------------------- */

      resize.observe(canvas);

      /* -------------------------------------------------------------------- */
      /*                            EVENT LISTENERS                             */
      /* -------------------------------------------------------------------- */

      window.addEventListener(
        "resize",
        schedule
      );

      const onScroll = () => {
        until = performance.now() + 600;
        schedule();
      };

      window.addEventListener(
        "scroll",
        onScroll,
        true
      );

      document.addEventListener(
        "visibilitychange",
        schedule
      );

      document.addEventListener(
        "pointerdown",
        interaction,
        true
      );

      document.addEventListener(
        "transitionrun",
        interaction,
        true
      );

      document.addEventListener(
        "animationstart",
        interaction,
        true
      );

      document.addEventListener(
        "toggle",
        changed,
        true
      );

      scopeRef?.current?.addEventListener(
        "pointermove",
        schedule
      );

      /* -------------------------------------------------------------------- */
      /*                                CLEANUP                                */
      /* -------------------------------------------------------------------- */

      disposeRenderer = () => {
        stopped = true;

        if (frame) {
          cancelAnimationFrame(
            frame
          );
        }

        if (image) {
          image.onload = null;
          image.onerror = null;
        }

        intersection.disconnect();
        resize.disconnect();
        mutations.disconnect();
        attributes.disconnect();

        window.removeEventListener(
          "resize",
          schedule
        );

        window.removeEventListener(
          "scroll",
          onScroll,
          true
        );

        document.removeEventListener(
          "visibilitychange",
          schedule
        );

        document.removeEventListener(
          "pointerdown",
          interaction,
          true
        );

        document.removeEventListener(
          "transitionrun",
          interaction,
          true
        );

        document.removeEventListener(
          "animationstart",
          interaction,
          true
        );

        document.removeEventListener(
          "toggle",
          changed,
          true
        );

        scopeRef?.current?.removeEventListener(
          "pointermove",
          schedule
        );

        /**
         * Clear the canvas before releasing the WebGL
         * resources so stale optical surfaces cannot remain
         * visible during teardown/theme changes.
         */
        gl.disable(
          gl.SCISSOR_TEST
        );

        gl.clearColor(
          0,
          0,
          0,
          0
        );

        gl.clear(
          gl.COLOR_BUFFER_BIT
        );

        release();
      };
    };

    /* ---------------------------------------------------------------------- */
    /*                             THEME OBSERVER                              */
    /* ---------------------------------------------------------------------- */

    const theme =
      new MutationObserver(
        start
      );

    theme.observe(
      root,
      {
        attributes: true,
        attributeFilter: [
          "data-theme",
        ],
      }
    );

    /* ---------------------------------------------------------------------- */
    /*                         WEBGL CONTEXT HANDLING                           */
    /* ---------------------------------------------------------------------- */

    const lost = (
      event: Event
    ) => {
      event.preventDefault();

      disposeRenderer?.();
      disposeRenderer =
        undefined;

      canvas.dataset.ready =
        "false";
    };

    canvas.addEventListener(
      "webglcontextlost",
      lost
    );

    canvas.addEventListener(
      "webglcontextrestored",
      start
    );

    /* ---------------------------------------------------------------------- */
    /*                     REDUCED TRANSPARENCY CHANGE                         */
    /* ---------------------------------------------------------------------- */

    reduced.addEventListener(
      "change",
      start
    );

    /* ---------------------------------------------------------------------- */
    /*                                START                                   */
    /* ---------------------------------------------------------------------- */

    start();

    /* ---------------------------------------------------------------------- */
    /*                           COMPONENT CLEANUP                              */
    /* ---------------------------------------------------------------------- */

    return () => {
      disposeRenderer?.();

      theme.disconnect();

      reduced.removeEventListener(
        "change",
        start
      );

      canvas.removeEventListener(
        "webglcontextlost",
        lost
      );

      canvas.removeEventListener(
        "webglcontextrestored",
        start
      );
    };
  }, [
    imageUrl,
    scopeRef,
    fallbackOnly,
  ]);

  return (
    <div
      className="nature-environment"
      aria-hidden="true"
      style={
        imageUrl
          ? ({
              "--nature-image": `url("${imageUrl}")`,
            } as CSSProperties)
          : undefined
      }
    >
      <canvas
        ref={canvasRef}
        data-ready="false"
      />
    </div>
  );
}