"use client";

import { useEffect, useState } from "react";
import Velaris from "@/components/ui/velaris";

export function ParallaxBackground() {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const updateTheme = () => {
      setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  const isDark = theme === "dark";

  return (
    <div className="ambient-background app-ambient-velaris" aria-hidden="true">
      <Velaris
        bg={isDark ? "#070d18" : "#f8fafc"}
        colors={
          isDark
            ? ["#12223b", "#172d4e", "#0e1a2d", "#1e375e"]
            : ["#dce8f5", "#e5eef7", "#d5e3f2", "#eaf1f9"]
        }
        speed={1.3}
        grain={0.03}
        height="100%"
        className="app-velaris-surface"
      />
    </div>
  );
}
