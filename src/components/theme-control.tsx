"use client";

import { useEffect, useId, useState } from "react";
import { MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { parseTheme, THEME_KEY, type Theme } from "@/lib/theme";

export function ThemeControl({
  labels = { theme: "Тема", light: "Светлая", dark: "Тёмная" },
}: { labels?: Record<"theme" | Theme, string> }) {
  const name = useId();
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => {
      let selected = parseTheme(document.documentElement.dataset.theme);
      try { selected = parseTheme(localStorage.getItem(THEME_KEY)); }
      catch { /* The pre-paint theme still works without storage. */ }
      setTheme(selected);
      setReady(true);
      document.documentElement.dataset.theme = selected;
      document.documentElement.style.colorScheme = selected;
    };
    const storage = (event: StorageEvent) => {
      if (event.key === THEME_KEY || event.key === null) sync();
    };
    const timer = window.setTimeout(sync, 0);
    window.addEventListener("storage", storage);
    return () => { clearTimeout(timer); window.removeEventListener("storage", storage); };
  }, []);

  function change(selected: Theme) {
    setTheme(selected);
    try { localStorage.setItem(THEME_KEY, selected); }
    catch { /* Theme changes remain usable when storage is blocked. */ }
    document.documentElement.setAttribute("data-theme", selected);
    document.documentElement.style.setProperty("color-scheme", selected);
  }

  return (
    <fieldset className="theme-switch" role="radiogroup" aria-label={labels.theme} disabled={!ready}>
      <legend className="sr-only">{labels.theme}</legend>
      <span className="theme-indicator" aria-hidden="true" />
      {(["light", "dark"] as const).map(value => (
        <label key={value}>
          <input type="radio" name={name} value={value} checked={theme === value} onChange={() => change(value)} />
          <span>{value === "light" ? <SunIcon aria-hidden="true" /> : <MoonIcon aria-hidden="true" />}{labels[value]}</span>
        </label>
      ))}
    </fieldset>
  );
}
