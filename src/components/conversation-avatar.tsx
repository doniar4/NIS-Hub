"use client";
import Image from "next/image";
import { useState } from "react";

export function ConversationAvatar({
  url,
  name,
}: {
  url?: string | null;
  name: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <span className="conversation-initial" aria-hidden="true">
      {url && failedUrl !== url ? (
        <Image
          unoptimized
          src={url}
          alt=""
          width={36}
          height={36}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        Array.from(name.trim())[0]?.toLocaleUpperCase() || "N"
      )}
    </span>
  );
}
