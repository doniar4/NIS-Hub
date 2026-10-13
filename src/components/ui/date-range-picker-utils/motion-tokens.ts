export const motionTokens = {
  blur: { subtle: 2, soft: 4 },
  ease: { enter: [.22, 1, .36, 1], standard: [.4, 0, .2, 1] },
  spring: { morph: { type: "spring", stiffness: 360, damping: 38, mass: 1 } },
} as const;
