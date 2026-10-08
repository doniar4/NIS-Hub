"use client";
import Image from "next/image";
import { useEffect, useId } from "react";
import { usePathname } from "next/navigation";
import { promotionVisible } from "@/lib/install-awareness";
import { installCopy } from "@/lib/install-copy";
import { useI18n } from "./locale-provider";
import { useInstall } from "./install-provider";

export function InstallHomeCard() {
  const { state, controller } = useInstall(),
    { locale } = useI18n(),
    t = installCopy(locale),
    id = useId();
  if (
    !promotionVisible(state, state.checkedAt) ||
    state.reminderPath !== null ||
    state.reminderUsed
  )
    return null;
  return (
    <section className="surface-card install-home" aria-labelledby={id}>
      <div className="install-card-copy">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={40}
          height={40}
          unoptimized
        />
        <div>
          <h2 id={id}>{t.homeTitle}</h2>
          <p>{t.body}</p>
        </div>
      </div>
      <div className="install-actions">
        <button
          className="button button-secondary"
          type="button"
          aria-haspopup="dialog"
          onClick={(event) => controller.openGuide(event.currentTarget)}
        >
          {t.how}
        </button>
        <button
          className="text-link"
          type="button"
          onClick={() => controller.dismiss()}
        >
          {t.later}
        </button>
      </div>
    </section>
  );
}
export function InstallReminder() {
  const { state, controller } = useInstall(),
    { locale } = useI18n(),
    t = installCopy(locale),
    path = usePathname();
  const allowed =
    path !== "/profile" &&
    !path.startsWith("/admin") &&
    !/^\/books\/[^/]+\/read$/.test(path);
  useEffect(() => {
    // Synchronize before claiming: child effects may precede the shared root's
    // route effect when arriving from Profile, Reader or Admin.
    controller.routeChanged(path);
    if (allowed) controller.claimReminder(path);
  }, [allowed, controller, path, state.ready]);
  if (
    !allowed ||
    state.reminderPath !== path ||
    !promotionVisible(state, state.checkedAt)
  )
    return null;
  return (
    <aside className="surface-card install-reminder" aria-label={t.title}>
      <p>{t.reminder}</p>
      <div className="install-actions">
        <button
          className="button button-secondary"
          type="button"
          aria-haspopup="dialog"
          onClick={(event) => controller.openGuide(event.currentTarget)}
        >
          {t.show}
        </button>
        <button
          className="text-link"
          type="button"
          onClick={() => controller.dismiss()}
        >
          {t.later}
        </button>
      </div>
    </aside>
  );
}
export function InstallProfileEntry() {
  const { state, controller } = useInstall(),
    { locale } = useI18n(),
    t = installCopy(locale);
  return (
    <section className="surface-card install-profile">
      {state.installed ? (
        <div className="install-card-copy">
          <Image
            src="/icons/icon-192.png"
            width={40}
            height={40}
            alt=""
            unoptimized
          />
          <div>
            <h2>{t.installed}</h2>
            <p>{t.installedHint}</p>
          </div>
        </div>
      ) : (
        <button
          className="install-profile-button"
          type="button"
          aria-haspopup="dialog"
          onClick={(event) => controller.openGuide(event.currentTarget)}
          disabled={!state.ready}
        >
          <Image
            src="/icons/icon-192.png"
            width={40}
            height={40}
            alt=""
            unoptimized
          />
          <span>
            <strong>{t.title}</strong>
            <span>{t.subtitle}</span>
          </span>
          <span aria-hidden>›</span>
        </button>
      )}
    </section>
  );
}
