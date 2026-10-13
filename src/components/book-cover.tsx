"use client";

import Image from "next/image";
import { useState } from "react";
import { useI18n } from "./locale-provider";
import { communityCopy } from "@/lib/community-copy";

export function BookCover({ title, url }: { title: string; url: string | null }) {
  const { locale } = useI18n();
  const p = communityCopy(locale);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const hasImage = Boolean(url && failedUrl !== url);

  return (
    <div
      className="book-first-page"
      role="img"
      aria-label={`${p.cover}: ${title}${hasImage ? "" : ` — ${p.coverFailed}`}`}
    >
      {url && hasImage ? (
        <Image
          unoptimized
          src={url}
          width={100}
          height={150}
          alt=""
          className="reading-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <div className="cover-unavailable" aria-hidden="true">
          <span>{p.coverFailed}</span>
        </div>
      )}
    </div>
  );
}
