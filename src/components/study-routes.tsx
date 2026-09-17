"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { vintageCopy } from "@/lib/vintage-copy";
import { useI18n } from "./locale-provider";
import { RouteIllustration } from "./academic-art";
import { ArrowRightIcon } from "./icons";

export function StudyRoutes() {
  const { locale } = useI18n();
  const c = vintageCopy(locale);
  const [active, setActive] = useState(0);
  const id = useId();
  const routes = [
    { kind: "library" as const, title: c.library, hint: c.libraryHint, href: "/library", action: c.openLibrary },
    { kind: "schedule" as const, title: c.schedule, hint: c.scheduleHint, href: "/schedule", action: c.openSchedule },
    { kind: "profile" as const, title: c.profile, hint: c.profileHint, href: "/profile", action: c.openProfile },
  ];
  return <div className="study-routes">{routes.map((route, index) => <section key={route.kind} className="study-route" data-expanded={active === index}>
    <h3><button type="button" id={`${id}-trigger-${index}`} aria-expanded={active === index} aria-controls={`${id}-panel-${index}`} onClick={() => setActive(index)}>
      <span>{route.title}</span><span aria-hidden="true" className="route-plus">{active === index ? "−" : "+"}</span>
    </button></h3>
    <div className="route-art" aria-hidden="true"><RouteIllustration kind={route.kind} /></div>
    <div id={`${id}-panel-${index}`} role="region" aria-labelledby={`${id}-trigger-${index}`} hidden={active !== index} className="route-detail">
      <p>{route.hint}</p><Link href={route.href} className="section-link">{route.action}<ArrowRightIcon size={17} /></Link>
    </div>
  </section>)}</div>;
}
