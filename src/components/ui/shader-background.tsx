"use client";

import { useEffect, useRef } from "react";

const vertexSource = `attribute vec4 aVertexPosition;
void main() { gl_Position = aVertexPosition; }`;

// The supplied plasma shader; inverse smoothsteps are expressed in defined GLSL order.
const fragmentSource = `
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float iTheme;
const float gridSmoothWidth = 0.015;
const float lineSpeed = 0.2;
const float lineFrequency = 0.2;
const float warpSpeed = 0.04;
const float offsetSpeed = 0.266;
#define drawCircle(pos, radius, coord) (1.0 - smoothstep(radius, radius + gridSmoothWidth, length(coord - (pos))))
#define drawSmoothLine(pos, halfWidth, t) (1.0 - smoothstep(0.0, halfWidth, abs(pos - (t))))
#define drawCrispLine(pos, halfWidth, t) (1.0 - smoothstep(halfWidth, halfWidth + gridSmoothWidth, abs(pos - (t))))
float random(float t) {
  return (cos(t) + cos(t * 1.3 + 1.3) + cos(t * 1.4 + 1.4)) / 3.0;
}
float getPlasmaY(float x, float horizontalFade, float offset) {
  return random(x * lineFrequency + iTime * lineSpeed) * horizontalFade + offset;
}
void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  vec2 space = (gl_FragCoord.xy - iResolution.xy / 2.0) / iResolution.x * 10.0;
  float horizontalFade = 1.0 - (cos(uv.x * 6.28) * 0.5 + 0.5);
  float verticalFade = 1.0 - (cos(uv.y * 6.28) * 0.5 + 0.5);
  space.y += random(space.x * 0.5 + iTime * warpSpeed) * (0.5 + horizontalFade);
  space.x += random(space.y * 0.5 + iTime * warpSpeed + 2.0) * horizontalFade;
  float lines = 0.0;
  for (int l = 0; l < 16; l++) {
    float normalizedLineIndex = float(l) / 16.0;
    float offsetTime = iTime * offsetSpeed;
    float offsetPosition = float(l) + space.x * 0.5;
    float rand = random(offsetPosition + offsetTime) * 0.5 + 0.5;
    float halfWidth = mix(0.01, 0.2, rand * horizontalFade) / 2.0;
    float offset = random(offsetPosition + offsetTime * (1.0 + normalizedLineIndex)) * mix(0.6, 2.0, horizontalFade);
    float linePosition = getPlasmaY(space.x, horizontalFade, offset);
    // Light appearance uses only the crisp stroke. The soft halo belongs to dark appearance.
    float line = drawCrispLine(linePosition, halfWidth * 0.12, space.y);
    line += drawSmoothLine(linePosition, halfWidth, space.y) * 0.38 * iTheme;
    float circleX = mod(float(l) + iTime * lineSpeed, 25.0) - 12.0;
    vec2 circlePosition = vec2(circleX, getPlasmaY(circleX, horizontalFade, offset));
    line += drawCircle(circlePosition, 0.01, space) * 2.5 * iTheme;
    lines += line * rand;
  }
  vec3 lightBackground = mix(vec3(0.985, 0.988, 0.995), vec3(0.925, 0.935, 0.950), uv.x);
  vec3 darkBackground = mix(vec3(0.008, 0.030, 0.070), vec3(0.015, 0.080, 0.155), uv.x);
  darkBackground *= 0.72 + verticalFade * 0.28;
  vec3 background = mix(lightBackground, darkBackground, iTheme);
  vec3 stroke = mix(vec3(0.10, 0.12, 0.15), vec3(0.035, 0.33, 0.72), iTheme);
  float strokeStrength = clamp(lines * mix(0.34, 0.54, iTheme), 0.0, mix(0.72, 0.94, iTheme));
  gl_FragColor = vec4(mix(background, stroke, strokeStrength), 1.0);
}`;

export default function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" });
    if (!gl) return; // The containing element supplies a gradient fallback.
    const shaders: WebGLShader[] = [];
    const program = gl.createProgram();
    const buffer = gl.createBuffer();
    const dispose = () => {
      shaders.forEach(shader => gl.deleteShader(shader));
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
    if (!program || !buffer) { dispose(); return; }
    for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]] as const) {
      const shader = gl.createShader(type);
      if (!shader) { dispose(); return; }
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { dispose(); return; }
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { dispose(); return; }
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "aVertexPosition");
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(position);
    const resolution = gl.getUniformLocation(program, "iResolution");
    const time = gl.getUniformLocation(program, "iTime");
    const theme = gl.getUniformLocation(program, "iTheme");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let visible = false;
    let elapsed = 0;
    let previous = 0;
    let themeValue = document.documentElement.dataset.theme === "dark" ? 1 : 0;
    const draw = () => {
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(time, elapsed);
      gl.uniform1f(theme, themeValue);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const render = (now: number) => {
      elapsed += previous ? Math.min((now - previous) / 1000, 0.05) : 0;
      previous = now;
      draw();
      frame = requestAnimationFrame(render);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      previous = 0;
      if (visible && !document.hidden && !reduced.matches) frame = requestAnimationFrame(render);
      else draw();
    };
    const resize = new ResizeObserver(() => {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      draw();
    });
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    const themeObserver = new MutationObserver(() => {
      themeValue = document.documentElement.dataset.theme === "dark" ? 1 : 0;
      draw();
    });
    resize.observe(canvas);
    intersection.observe(canvas);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
      dispose();
    };
  }, []);
  return <canvas ref={canvasRef} className="shader-background" aria-hidden="true" />;
}
