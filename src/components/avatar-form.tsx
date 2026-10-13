"use client";
import { useEffect, useRef, useState, useTransition, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { AvatarPreview } from "./avatar-preview";
import { useI18n } from "./locale-provider";
import { avatarCrop, AVATAR_EDITOR_LIMIT } from "@/lib/avatar-crop";
import { avatarEditorCopy } from "@/lib/avatar-editor-copy";
import type { ActionState, FormAction } from "@/lib/action-state";

type Picture = { url: string; image: HTMLImageElement; name: string };
const clamp = (value: number) => Math.max(-1, Math.min(1, value));

export function AvatarForm({ url, action, hasAvatar = !!url, hidePreview = false }: { url: string | null; action: FormAction; hasAvatar?: boolean; hidePreview?: boolean }) {
  const router = useRouter();
  const { t, locale } = useI18n(), c = avatarEditorCopy(locale);
  const [picture, setPicture] = useState<Picture | null>(null);
  const [zoom, setZoom] = useState(1), [x, setX] = useState(0), [y, setY] = useState(0);
  const [feedback, setFeedback] = useState<ActionState>({});
  const [loading, setLoading] = useState(false);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null), preview = useRef<HTMLDivElement>(null);
  const selection = useRef(0), objectUrl = useRef<string | null>(null), saving = useRef(false);
  const drag = useRef<{ id: number; x: number; y: number; initialX: number; initialY: number } | null>(null);

  useEffect(() => () => {
    selection.current++;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  function reset() { setZoom(1); setX(0); setY(0); }
  function clear() {
    selection.current++;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    setPicture(null); setLoading(false); reset();
    if (input.current) input.current.value = "";
  }
  async function choose(file: File | undefined) {
    clear(); setFeedback({});
    if (!file) return;
    if (!file.size || file.size > AVATAR_EDITOR_LIMIT) { setFeedback({ error: c.invalid }); return; }
    const version = selection.current, source = URL.createObjectURL(file);
    objectUrl.current = source; setLoading(true);
    const image = new window.Image();
    image.onload = () => {
      if (version !== selection.current) return;
      setLoading(false);
      if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 40_000_000) {
        clear(); setFeedback({ error: c.invalid }); return;
      }
      setPicture({ url: source, image, name: file.name });
    };
    image.onerror = () => {
      if (version !== selection.current) return;
      clear(); setFeedback({ error: c.invalid });
    };
    image.src = source;
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const point = drag.current;
    if (!point || point.id !== event.pointerId || !picture) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const crop = avatarCrop(picture.image.naturalWidth, picture.image.naturalHeight, zoom, x, y);
    const overflowX = (picture.image.naturalWidth / crop.size - 1) * rect.width;
    const overflowY = (picture.image.naturalHeight / crop.size - 1) * rect.height;
    if (overflowX > 0) setX(clamp(point.initialX - (event.clientX - point.x) * 2 / overflowX));
    if (overflowY > 0) setY(clamp(point.initialY - (event.clientY - point.y) * 2 / overflowY));
  }
  function save() {
    if (!picture || saving.current) return;
    saving.current = true; setFeedback({});
    start(async () => {
      try {
        const crop = avatarCrop(picture.image.naturalWidth, picture.image.naturalHeight, zoom, x, y);
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 512;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        context.fillStyle = "#ffffff"; context.fillRect(0, 0, 512, 512);
        context.drawImage(picture.image, crop.left, crop.top, crop.size, crop.size, 0, 0, 512, 512);
        // JPEG canvas export works in Safari, Firefox and Chromium alike.
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Export failed")), "image/jpeg", 0.9));
        const data = new FormData(); data.set("avatar", blob, "avatar.jpg");
        const result = await action({}, data);
        setFeedback(result);
        if (result.success) {
          clear();
          window.dispatchEvent(new Event("nis-profile-saved"));
          router.refresh();
        }
      } catch { setFeedback({ error: t.saveError }); }
      finally { saving.current = false; }
    });
  }
  const crop = picture && avatarCrop(picture.image.naturalWidth, picture.image.naturalHeight, zoom, x, y);
  return <section className="surface-card avatar-settings" aria-labelledby="avatar-heading">
    <h2 id="avatar-heading" className="section-title">{t.avatar}</h2>
    {hasAvatar && !hidePreview && <AvatarPreview key={url ?? "unavailable"} url={url} onRetry={() => router.refresh()} />}
    <p id="avatar-hint" className="my-4 text-sm text-[var(--muted)]">{t.avatarHint}</p>
    <form data-lenis-prevent onSubmit={event => { event.preventDefault(); save(); }} aria-busy={pending || loading}>
      <fieldset disabled={pending} className="avatar-editor-fields">
        <div><span className="field-label">{t.avatarFile}</span><input ref={input} hidden type="file" aria-label={t.avatarFile} accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.avif,.bmp,.heic,.heif" aria-describedby="avatar-hint" onChange={event => { void choose(event.currentTarget.files?.[0]); }} />
          <div className="avatar-file-control"><button type="button" className="button button-secondary" onClick={() => input.current?.click()}>{c.choose}</button><span>{picture?.name ?? c.noFile}</span></div>
        </div>
        {loading && <p role="status">{c.loading}</p>}
        {picture && crop && <>
          <div ref={preview} className="avatar-crop-preview" role="img" aria-label={c.crop} tabIndex={0}
            onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, initialX: x, initialY: y }; }}
            onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
            onKeyDown={event => { if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return; event.preventDefault(); if (event.key === "ArrowLeft") setX(clamp(x - 0.1)); if (event.key === "ArrowRight") setX(clamp(x + 0.1)); if (event.key === "ArrowUp") setY(clamp(y - 0.1)); if (event.key === "ArrowDown") setY(clamp(y + 0.1)); }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Local object URL used by the canvas editor. */}
            <img src={picture.url} alt="" draggable={false} style={{ width: `${picture.image.naturalWidth / crop.size * 100}%`, height: `${picture.image.naturalHeight / crop.size * 100}%`, left: `${-crop.left / crop.size * 100}%`, top: `${-crop.top / crop.size * 100}%` }} />
            <span className="avatar-crop-guide" aria-hidden="true" />
          </div>
          <p className="profile-hint">{c.hint}</p>
          <label className="avatar-crop-control"><span>{c.zoom}</span><input type="range" min="1" max="4" step="0.01" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label>
          <label className="avatar-crop-control"><span>{c.x}</span><input type="range" min="-1" max="1" step="0.01" value={x} onChange={event => setX(Number(event.target.value))} /></label>
          <label className="avatar-crop-control"><span>{c.y}</span><input type="range" min="-1" max="1" step="0.01" value={y} onChange={event => setY(Number(event.target.value))} /></label>
          <div className="avatar-editor-actions"><button type="button" className="button button-secondary" onClick={reset}>{c.reset}</button><button type="button" className="button button-secondary" onClick={() => { clear(); setFeedback({}); }}>{c.cancel}</button></div>
        </>}
        <button type="submit" className="button" disabled={!picture || loading || pending}>{pending ? t.pending : t.avatarUpload}</button>
      </fieldset>
      {feedback.error && <p className="form-error" role="alert">{feedback.error}</p>}
      {feedback.success && <p className="text-sm text-[var(--success)]" role="status">{feedback.success}</p>}
    </form>
  </section>;
}
