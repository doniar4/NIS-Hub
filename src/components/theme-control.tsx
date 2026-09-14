"use client";
import { useEffect, useRef, useState, useId } from "react";
import { parseTheme, resolvedTheme, THEME_KEY, type Theme } from "@/lib/theme";

export function ThemeControl({ labels = { theme: "Тема", light: "Светлая", dark: "Тёмная", system: "Системная" } }: { labels?: Record<"theme" | Theme, string> }) {
  const name=useId(),indicator=useRef<HTMLSpanElement>(null);
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
    if(selected!==theme && !matchMedia("(prefers-reduced-motion: reduce)").matches) indicator.current?.animate([{clipPath:"inset(0 0 round 5px)"},{clipPath:"inset(0 14% round 12px)",offset:.5},{clipPath:"inset(0 0 round 5px)"}],{duration:280,easing:"ease-in-out"});
    preference.current = selected;
    setTheme(selected);
    try { localStorage.setItem(THEME_KEY, selected); } catch { /* No persistence available. */ }
    const effective = resolvedTheme(selected, matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme",effective);
    document.documentElement.style.setProperty("color-scheme",effective);
  }
  return <fieldset className="theme-switch" role="radiogroup" aria-label={labels.theme} disabled={!ready}><legend className="sr-only">{labels.theme}</legend><span ref={indicator} className="theme-indicator" aria-hidden="true" style={{left:"calc(4px + "+(["light","dark","system"].indexOf(theme))+" * (100% - 8px) / 3)"}}/>{(["light","dark","system"] as const).map(value=><label key={value}><input type="radio" name={name} value={value} checked={theme===value} onChange={()=>change(value)}/><span>{labels[value]}</span></label>)}</fieldset>;
}
