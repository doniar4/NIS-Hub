"use client";
import { useEffect, useRef, useState } from "react";
import { parseTheme, resolvedTheme, THEME_KEY, type Theme } from "@/lib/theme";

export function ThemeControl({ labels = { theme: "Тема", light: "Светлая", dark: "Тёмная", system: "Системная" } }: { labels?: Record<"theme" | Theme, string> }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [ready, setReady] = useState(false);
  const preference = useRef<Theme>("system");
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      setTheme(preference.current); setReady(true);
      document.documentElement.dataset.theme = resolvedTheme(preference.current, media.matches);
      document.documentElement.style.colorScheme = resolvedTheme(preference.current, media.matches);
    };
    try { preference.current = parseTheme(localStorage.getItem(THEME_KEY)); } catch { /* Storage may be blocked. */ }
    const storage = (event: StorageEvent) => { if (event.key === THEME_KEY || event.key === null) { preference.current = parseTheme(event.newValue); sync(); } };
    const timer = window.setTimeout(sync, 0);
    media.addEventListener("change", sync);
    window.addEventListener("storage", storage);
    return () => { clearTimeout(timer); media.removeEventListener("change", sync); window.removeEventListener("storage", storage); };
  }, []);
  function change(value: string) {
    const selected = parseTheme(value);
    preference.current = selected;
    setTheme(selected);
    try { localStorage.setItem(THEME_KEY, selected); } catch { /* No persistence available. */ }
    const effective = resolvedTheme(selected, matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = effective;
    document.documentElement.style.colorScheme = effective;
  }
  return <label className="flex items-center gap-2 text-sm"><span>{labels.theme}</span><select aria-label={labels.theme} className="field !w-auto !py-2" disabled={!ready} value={theme} onChange={e => change(e.target.value)}><option value="light">{labels.light}</option><option value="dark">{labels.dark}</option><option value="system">{labels.system}</option></select></label>;
}
