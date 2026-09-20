"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatBubbleIcon, PersonIcon, HeartIcon } from "@radix-ui/react-icons";
import { v053Copy } from "@/lib/v053-copy";
import { communityCopy } from "@/lib/community-copy";
import type { Locale } from "@/lib/i18n";

export function CommunityNav({ locale }: { locale: Locale }) {
  const p = v053Copy(locale),
    path = usePathname();
  const items = [
    { href: "/people", label: p.people, icon: PersonIcon },
    { href: "/friends", label: p.friends, icon: HeartIcon },
    {
      href: "/messages",
      label: communityCopy(locale).messages,
      icon: ChatBubbleIcon,
    },
  ];
  return (
    <nav aria-label={p.community} className="community-nav">
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={
            path === href || path.startsWith(href + "/") ? "page" : undefined
          }
        >
          <Icon />
          {label}
        </Link>
      ))}
    </nav>
  );
}
