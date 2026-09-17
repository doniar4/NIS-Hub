import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRightIcon } from "@/components/icons";

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

export function PageIntro({ kicker, title, children }: { kicker?: string; title: string; children?: ReactNode }) {
  return <div className="page-intro"><Eyebrow>{kicker ?? "NIS Hub"}</Eyebrow><h1 className="page-title">{title}</h1>{children ? <div className="page-description">{children}</div> : null}</div>;
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="notice" role="note">{children}</div>;
}

export function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link className="section-link" href={href}>{children}<ArrowRightIcon size={16} /></Link>;
}

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: { href: string; label: string } }) {
  return <div className="empty-state"><h2>{title}</h2><div className="mt-2 max-w-xl leading-6 text-[var(--muted)]">{children}</div>{action ? <div className="mt-6"><SectionLink href={action.href}>{action.label}</SectionLink></div> : null}</div>;
}
