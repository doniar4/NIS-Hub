export const THEME_KEY = "nis-theme";
export type Theme = "light" | "dark" | "system";
export function parseTheme(value: unknown): Theme { return value === "light" || value === "dark" ? value : "system"; }
export function resolvedTheme(theme: Theme, dark: boolean) { return theme === "system" ? (dark ? "dark" : "light") : theme; }
// Constant, synchronous head script: runs before body paint, with no user input.
export const themeBootstrap = `(()=>{let t="system";try{const v=localStorage.getItem("nis-theme");if(v==="light"||v==="dark")t=v}catch{}const d=t==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;document.documentElement.dataset.theme=d;document.documentElement.style.colorScheme=d})()`;
