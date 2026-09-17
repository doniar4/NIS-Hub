"use client";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useI18n } from "./locale-provider";
import { RefreshIcon } from "./icons";
// Parent keys by URL so a newly signed URL gets a fresh image/error state.
export function AvatarPreview({ url, onRetry }: { url: string | null; onRetry: () => void }) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(!url);
  const [pending, startTransition] = useTransition();
  return failed ? <div className="my-4"><p role="status">{t.avatarUnavailable}</p>
    <button className="button button-secondary button-reload mt-3" type="button" disabled={pending}
      onClick={() => { if (url) setFailed(false); startTransition(onRetry); }}><RefreshIcon />{pending ? t.pending : t.retry}</button></div> :
    <Image unoptimized loading="eager" src={url!} width={96} height={96} alt={t.avatar}
      className="my-4 rounded-md" referrerPolicy="no-referrer" onError={() => setFailed(true)}/>;
}
