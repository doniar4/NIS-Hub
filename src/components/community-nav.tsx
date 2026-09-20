import Link from "next/link";
import { v053Copy } from "@/lib/v053-copy";
import { communityCopy } from "@/lib/community-copy";
import type { Locale } from "@/lib/i18n";
export function CommunityNav({locale}:{locale:Locale}){const p=v053Copy(locale);return <nav aria-label={p.community} className="community-nav"><Link href="/people">{p.people}</Link><Link href="/friends">{p.friends}</Link><Link href="/messages">{communityCopy(locale).messages}</Link></nav>;}
