"use client";
import { useEffect, useState } from "react";
import {
  HomeIcon,
  ReaderIcon,
  CalendarIcon,
  CheckCircledIcon,
  BarChartIcon,
  ChatBubbleIcon,
  MoonIcon,
  SunIcon,
} from "@radix-ui/react-icons";
import { Dock, DockItem, DockLabel, DockIcon } from "./ui/dock";
import { useI18n } from "./locale-provider";
import { profileActivityCopy } from "@/lib/profile-activity-copy";
import { parseTheme, THEME_KEY, type Theme } from "@/lib/theme";

export function ProfileDock() {
  const { locale } = useI18n(),
    c = profileActivityCopy(locale);
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    const sync = () =>
      setTheme(parseTheme(document.documentElement.dataset.theme));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  const links = [
    { label: c.home, href: "/", icon: HomeIcon },
    { label: c.library, href: "/library", icon: ReaderIcon },
    { label: c.schedule, href: "/schedule", icon: CalendarIcon },
    { label: c.tasks, href: "#profile-tasks", icon: CheckCircledIcon },
    { label: c.activity, href: "#profile-activity", icon: BarChartIcon },
    { label: c.messages, href: "/messages", icon: ChatBubbleIcon },
  ];
  function toggleTheme() {
    const selected = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(THEME_KEY, selected);
    } catch {}
    document.documentElement.dataset.theme = selected;
    document.documentElement.style.colorScheme = selected;
    setTheme(selected);
  }
  return (
    <div className="profile-shortcuts">
      <Dock label={c.dock}>
        {links.map(({ label, href, icon: Icon }) => (
          <DockItem key={href} label={label} href={href}>
            <DockLabel>{label}</DockLabel>
            <DockIcon>
              <Icon />
            </DockIcon>
          </DockItem>
        ))}
        <DockItem
          label={c.theme}
          onClick={toggleTheme}
          pressed={theme === "dark"}
        >
          <DockLabel>{c.theme}</DockLabel>
          <DockIcon>{theme === "dark" ? <SunIcon /> : <MoonIcon />}</DockIcon>
        </DockItem>
      </Dock>
    </div>
  );
}
