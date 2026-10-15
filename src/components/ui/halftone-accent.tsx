"use client";

import { useEffect, useRef } from "react";
import { halftoneFragmentSource } from "./halftone-shader";

const vertexSource = `attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;

/** Decorative, local accent. CSS supplies the same dotted texture without WebGL. */
export function HalftoneAccent({ paused = false }: { paused?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
    canvasRef.current?.dispatchEvent(new Event("halftone-motion-change"));
  }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    if (!gl) return;

    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let scene: WebGLUniformLocation | null = null;
    let frame = 0;
    let visible = false;
    let time = 0;
    let lastFrame = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function release() {
      if (buffer) gl!.deleteBuffer(buffer);
      if (program) gl!.deleteProgram(program);
      buffer = null;
      program = null;
    }

    function compile(type: number, source: string) {
      const shader = gl!.createShader(type);
      if (!shader) return null;
      gl!.shaderSource(shader, source);
      gl!.compileShader(shader);
      if (gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) return shader;
      gl!.deleteShader(shader);
      return null;
    }

    function initialize() {
      const vertex = compile(gl!.VERTEX_SHADER, vertexSource);
      const fragment = compile(gl!.FRAGMENT_SHADER, halftoneFragmentSource);
      program = gl!.createProgram();
      if (vertex && fragment && program) {
        gl!.attachShader(program, vertex);
        gl!.attachShader(program, fragment);
        gl!.linkProgram(program);
      }
      if (vertex) gl!.deleteShader(vertex);
      if (fragment) gl!.deleteShader(fragment);
      if (!vertex || !fragment || !program || !gl!.getProgramParameter(program, gl!.LINK_STATUS)) {
        release();
        return;
      }
      buffer = gl!.createBuffer();
      if (!buffer) {
        release();
        return;
      }
      gl!.useProgram(program);
      gl!.bindBuffer(gl!.ARRAY_BUFFER, buffer);
      // One triangle covers the canvas without a diagonal seam.
      gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl!.STATIC_DRAW);
      const position = gl!.getAttribLocation(program, "a_position");
      gl!.enableVertexAttribArray(position);
      gl!.vertexAttribPointer(position, 2, gl!.FLOAT, false, 0, 0);
      const colors = new Float32Array(24);
      colors.set([0.043, 0.063, 0.149, 0.239, 0.275, 0.910, 0.694, 0.549, 1, 1, 0.839, 0.906]);
      gl!.uniform3fv(gl!.getUniformLocation(program, "u_colors[0]"), colors);
      const uniforms = {
        u_shape: [1.48, 0.88, 0.50, 0],
        u_surface: [2.40, 0.91, 0, 1],
        u_finish: [0, 0, 0, 0.06],
        u_transform: [2926, 0, 0, 0],
        u_space: [0, 0, 0, 0],
        u_cursor: [0, 2, 0.65, 0.46],
      };
      for (const [name, values] of Object.entries(uniforms)) {
        gl!.uniform4fv(gl!.getUniformLocation(program, name), values);
      }
      scene = gl!.getUniformLocation(program, "u_scene");
    }

    function draw() {
      if (!program || gl!.isContextLost()) return;
      const rect = canvas!.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas!.width !== width || canvas!.height !== height) {
        canvas!.width = width;
        canvas!.height = height;
      }
      gl!.viewport(0, 0, width, height);
      gl!.uniform4f(scene, width, height, time * 1.43, 4);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      canvas!.dataset.ready = "true";
    }

    function animate(now: number) {
      frame = requestAnimationFrame(animate);
      if (now - lastFrame < 1000 / 30) return;
      if (lastFrame) time += Math.min((now - lastFrame) / 1000, 0.1);
      lastFrame = now;
      draw();
    }

    function syncMotion() {
      cancelAnimationFrame(frame);
      lastFrame = 0;
      if (!visible || document.hidden || !program || gl!.isContextLost()) return;
      draw();
      if (!reducedMotion.matches && !pausedRef.current && document.documentElement.dataset.motion !== "paused") {
        frame = requestAnimationFrame(animate);
      }
    }

    function loseContext(event: Event) {
      event.preventDefault();
      cancelAnimationFrame(frame);
      delete canvas!.dataset.ready;
    }
    function restoreContext() {
      release();
      initialize();
      syncMotion();
    }

    initialize();
    const resize = new ResizeObserver(syncMotion);
    resize.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncMotion();
    });
    intersection.observe(canvas);
    const motion = new MutationObserver(syncMotion);
    motion.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
    document.addEventListener("visibilitychange", syncMotion);
    reducedMotion.addEventListener("change", syncMotion);
    canvas.addEventListener("halftone-motion-change", syncMotion);
    canvas.addEventListener("webglcontextlost", loseContext);
    canvas.addEventListener("webglcontextrestored", restoreContext);

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      motion.disconnect();
      document.removeEventListener("visibilitychange", syncMotion);
      reducedMotion.removeEventListener("change", syncMotion);
      canvas.removeEventListener("halftone-motion-change", syncMotion);
      canvas.removeEventListener("webglcontextlost", loseContext);
      canvas.removeEventListener("webglcontextrestored", restoreContext);
      release();
    };
  }, []);

  return <span className="halftone-accent" aria-hidden="true"><canvas ref={canvasRef} /></span>;
}
