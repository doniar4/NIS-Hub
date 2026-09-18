export const THEME_KEY = "nis-theme";
export type Theme = "light" | "dark";

// Legacy "system" and invalid preferences now use the explicit light default.
export function parseTheme(value: unknown): Theme {
  return value === "dark" ? "dark" : "light";
}

// Runs before first paint; keep its fallback in sync with parseTheme.
export const themeBootstrap = `(()=>{let t="light";try{t=localStorage.getItem("nis-theme")==="dark"?"dark":"light";localStorage.setItem("nis-theme",t)}catch{}document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t})()`;
