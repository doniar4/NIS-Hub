"use client";
import Image from "next/image";
import { useState } from "react";
import { useI18n } from "./locale-provider";
import { communityCopy } from "@/lib/community-copy";
export function ProfilePortrait({
  url,
  name,
}: {
  url: string | null;
  name: string;
}) {
  const { locale } = useI18n(),
    [failed, setFailed] = useState(false);
  return (
    <a
      href="#avatar-heading"
      className="profile-portrait"
      aria-label={communityCopy(locale).changeAvatar}
    >
      {url && !failed ? (
        <Image
          unoptimized
          width={96}
          height={96}
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">
          {name.trim().slice(0, 1).toLocaleUpperCase() || "N"}
        </span>
      )}
    </a>
  );
}
