"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { UserRoundPen, X } from "lucide-react";
import { useI18n } from "./locale-provider";
import { profileCopy } from "@/lib/profile-copy";

const dismissKey = "nis-profile-reminder-dismissed";
const dismissMs = 24 * 60 * 60 * 1000;

export function ProfileReminder() {
  const { locale } = useI18n(), p = profileCopy(locale), path = usePathname();
  const [visible, setVisible] = useState(false);
  const allowed = path !== "/profile" && !path.startsWith("/admin") && !/^\/books\/[^/]+\/read$/.test(path);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const dismissed = Number(localStorage.getItem(dismissKey) ?? 0);
      setVisible(!dismissed || Date.now() - dismissed > dismissMs);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!allowed || !visible) return null;
  return (
    <aside className="surface-card profile-reminder" aria-label={p.reminderTitle}>
      <span className="profile-reminder-icon" aria-hidden="true"><UserRoundPen size={20} /></span>
      <div className="profile-reminder-copy">
        <strong>{p.reminderTitle}</strong>
        <p>{p.reminderBody}</p>
      </div>
      <Link className="button button-small profile-reminder-action" href="/profile#profile-form">{p.reminderAction}</Link>
      <button
        type="button"
        className="profile-reminder-close"
        aria-label={p.later}
        title={p.later}
        onClick={() => { localStorage.setItem(dismissKey, String(Date.now())); setVisible(false); }}
      >
        <X size={16} />
      </button>
    </aside>
  );
}
