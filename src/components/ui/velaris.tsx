"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const vertexShaderGLSL = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShaderGLSL = `
precision highp float;
varying vec2 vUv;

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_grain;
uniform vec3  u_colors[4];
uniform vec3  u_bg;
uniform vec2  u_parallax;

vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
    dot(x12.zw,x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 uv = vUv;
  float ratio = u_resolution.x / u_resolution.y;
  vec2 p = uv - 0.5;
  p.x *= ratio;

  // Fluid continuous motion combined with silky parallax glide
  p += u_parallax * 0.28;
  float t = u_time * 0.32;

  float n1 = snoise(p * 0.32 + vec2(t * 0.24, -t * 0.30));
  float n2 = snoise(p * 0.48 + vec2(-t * 0.20, t * 0.26) + n1 * 0.28);
  float n3 = snoise(p * 0.62 + vec2(t * 0.16, -t * 0.22) + n2 * 0.24);

  vec3 col = u_bg;
  
  float dist = length(p) * 1.35;
  float vignette = 1.0 - smoothstep(0.40, 1.50, dist);
  
  col = mix(col, u_colors[0], smoothstep(-0.35, 0.55, n1) * 0.75);
  col = mix(col, u_colors[1], smoothstep(-0.25, 0.60, n2) * 0.68);
  col = mix(col, u_colors[2], smoothstep(-0.35, 0.52, n3) * 0.62);
  col = mix(col, u_colors[3], smoothstep(-0.15, 0.68, n1 * n2) * 0.50);

  float glow = smoothstep(1.2, 0.15, dist);
  col = mix(col, u_colors[0], glow * 0.18);

  // Clean fade to background at borders — never dark muddy spots!
  col = mix(u_bg, col, vignette);

  float grain = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453 + u_time);
  col += (grain - 0.5) * u_grain * 0.05;

  gl_FragColor = vec4(col, 1.0);
}
`;

export interface VelarisProps {
  bg?: string;
  colors?: string[];
  speed?: number;
  grain?: number;
  height?: string;
  className?: string;
  children?: React.ReactNode;
}

const DEFAULT_COLORS = ["#12223b", "#172d4e", "#0e1a2d", "#1e375e"];

const Velaris = ({
  bg = "#08101e",
  colors = DEFAULT_COLORS,
  speed = 1.5,
  grain = 0.12,
  height = "100%",
  className,
  children,
}: VelarisProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const hexToRgb = (hex: string): [number, number, number] => {
    const h = hex.replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255,
    ];
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" });
    if (!gl) return;

    const createShader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    const program = gl.createProgram()!;
    gl.attachShader(program, createShader(gl.VERTEX_SHADER, vertexShaderGLSL));
    gl.attachShader(
      program,
      createShader(gl.FRAGMENT_SHADER, fragmentShaderGLSL),
    );
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const pos = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const locs = {
      res: gl.getUniformLocation(program, "u_resolution"),
      time: gl.getUniformLocation(program, "u_time"),
      grain: gl.getUniformLocation(program, "u_grain"),
      colors: gl.getUniformLocation(program, "u_colors"),
      bg: gl.getUniformLocation(program, "u_bg"),
      parallax: gl.getUniformLocation(program, "u_parallax"),
    };

    let hasRendered = false;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.round(container.clientWidth * dpr));
      const height = Math.max(1, Math.round(container.clientHeight * dpr));
      if (canvas.width === width && canvas.height === height) return;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, canvas.width, canvas.height);
      // Resizing clears this opaque WebGL buffer to black. ResizeObserver runs
      // after rAF; redraw now so WebKit cannot composite that cleared frame
      // through the translucent page while mobile browser chrome resizes.
      if (hasRendered) {
        gl.uniform2f(locs.res, width, height);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let targetParallaxX = 0;
    let targetParallaxY = 0;
    let currentParallaxX = 0;
    let currentParallaxY = 0;

    const handleScroll = () => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const scrollY = window.scrollY || window.pageYOffset || 0;
      targetParallaxY = (scrollY / maxScroll - 0.5) * 1.2;
    };

    const handleMouseMove = (event: MouseEvent) => {
      targetParallaxX = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 0.8;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    let raf: number;
    let elapsed = 0;
    let previous = 0;
    const render = (now: number) => {
      elapsed += previous ? Math.min((now - previous) / 1000, 0.05) : 0;
      previous = now;

      // Silky inertia damping for parallax
      currentParallaxX += (targetParallaxX - currentParallaxX) * 0.05;
      currentParallaxY += (targetParallaxY - currentParallaxY) * 0.05;

      gl.uniform2f(locs.res, canvas.width, canvas.height);
      gl.uniform1f(locs.time, elapsed * speed);
      gl.uniform1f(locs.grain, grain);
      gl.uniform3f(locs.bg, ...hexToRgb(bg));
      gl.uniform2f(locs.parallax, currentParallaxX, currentParallaxY);

      const flat = new Float32Array(colors.slice(0, 4).flatMap(hexToRgb));
      gl.uniform3fv(locs.colors, flat);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      hasRendered = true;
      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(raf);
    };
  }, [bg, colors, speed, grain]);

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className={cn("relative w-full h-full overflow-hidden", className)}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      {children && <div className="relative z-10 h-full w-full">{children}</div>}
    </div>
  );
};

export default Velaris;
