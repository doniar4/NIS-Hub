"use client";

import React, { useRef, useState, type ReactNode } from "react";

export interface GlowCardProps {
  children?: ReactNode;
  className?: string;
  glowColor?: "blue" | "purple" | "green" | "red" | "orange";
  size?: "sm" | "md" | "lg";
  width?: string | number;
  height?: string | number;
  customSize?: boolean;
}

const glowColorMap = {
  blue: { base: 220, spread: 40 },
  purple: { base: 275, spread: 45 },
  green: { base: 145, spread: 35 },
  red: { base: 355, spread: 30 },
  orange: { base: 28, spread: 30 },
};

const sizeMap = {
  sm: "w-48 h-64",
  md: "w-64 h-80",
  lg: "w-80 h-96",
};

export const GlowCard: React.FC<GlowCardProps> = ({
  children,
  className = "",
  glowColor = "blue",
  size = "md",
  width,
  height,
  customSize = false,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const { base, spread } = glowColorMap[glowColor] ?? glowColorMap.blue;

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const xp = Math.min(1, Math.max(0, x / rect.width));

    card.style.setProperty("--x", `${x}px`);
    card.style.setProperty("--y", `${y}px`);
    card.style.setProperty("--hue", `${base + xp * spread}`);
  };

  const handlePointerEnter = () => setIsHovered(true);
  const handlePointerLeave = () => setIsHovered(false);

  const getSizeClasses = () => {
    if (customSize) return "";
    return sizeMap[size];
  };

  const containerStyles: React.CSSProperties = {
    ...(width !== undefined ? { width: typeof width === "number" ? `${width}px` : width } : {}),
    ...(height !== undefined ? { height: typeof height === "number" ? `${height}px` : height } : {}),
  };

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      style={containerStyles}
      className={`
        ${getSizeClasses()}
        ${!customSize ? "aspect-[3/4]" : ""}
        relative
        rounded-2xl
        p-4
        overflow-hidden
        transition-all duration-300
        backdrop-blur-xl
        bg-white/[0.04]
        border border-white/[0.12]
        shadow-xl
        ${className}
      `}
    >
      {/* Precision border glow: strictly masked to the 1.5px border line */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          padding: "1.5px",
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
          background: `radial-gradient(
            220px circle at var(--x, 50%) var(--y, 50%),
            hsl(var(--hue, 220) 85% 65% / 0.95),
            transparent 100%
          )`,
        }}
      />

      {/* Gentle, silky card surface spotlight sheen (no raw circular hard edges) */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-500"
        style={{
          opacity: isHovered ? 0.08 : 0,
          background: `radial-gradient(
            320px circle at var(--x, 50%) var(--y, 50%),
            hsl(var(--hue, 220) 90% 70% / 1),
            transparent 75%
          )`,
        }}
      />

      <div className="relative z-10 h-full w-full">{children}</div>
    </div>
  );
};

export default GlowCard;
