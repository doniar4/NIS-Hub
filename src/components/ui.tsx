import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRightIcon } from "@/components/icons";

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">{children}</p>;
}

export function PageIntro({ kicker, title, children }: { kicker?: string; title: string; children?: ReactNode }) {
  return <div className="max-w-2xl"><Eyebrow>{kicker ?? "NIS Hub"}</Eyebrow><h1 className="page-title">{title}</h1>{children ? <div className="mt-4 text-base leading-7 text-[var(--muted)]">{children}</div> : null}</div>;
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="notice" role="note">{children}</div>;
}

export function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)] underline-offset-4 hover:underline" href={href}>{children}<ArrowRightIcon size={16} /></Link>;
}

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: { href: string; label: string } }) {
  return <div className="border border-dashed border-[var(--line-strong)] bg-white px-6 py-10 sm:px-8"><h2 className="text-lg font-semibold tracking-[-0.02em]">{title}</h2><div className="mt-2 max-w-xl leading-6 text-[var(--muted)]">{children}</div>{action ? <div className="mt-6"><SectionLink href={action.href}>{action.label}</SectionLink></div> : null}</div>;
}
