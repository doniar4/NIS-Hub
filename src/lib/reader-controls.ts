export function readerKeyDelta(
  event: Pick<
    KeyboardEvent,
    "key" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "target"
  >,
): number {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
    return 0;
  const target = event.target;
  if (
    target instanceof Element &&
    target.closest(
      'input,textarea,select,button,a,[contenteditable]:not([contenteditable="false"]),dialog,[role="dialog"]',
    )
  )
    return 0;
  return event.key === "ArrowRight" || event.key === "PageDown"
    ? 1
    : event.key === "ArrowLeft" || event.key === "PageUp"
      ? -1
      : 0;
}
export function readerScale(
  width: number,
  height: number,
  baseWidth: number,
  baseHeight: number,
  fit: "width" | "page",
  zoom: number,
) {
  return (
    Math.max(
      0.05,
      Math.min(
        width / baseWidth,
        fit === "page" ? height / baseHeight : Infinity,
      ),
    ) * zoom
  );
}

type ReaderRect = Pick<DOMRect, "left" | "top" | "width" | "height">;
export function readerViewportRect(element: HTMLElement): ReaderRect {
  const bounds = element.getBoundingClientRect();
  return {
    left: bounds.left + element.clientLeft,
    top: bounds.top + element.clientTop,
    width: element.clientWidth,
    height: element.clientHeight,
  };
}
export function captureReaderAnchor(view: ReaderRect, page: ReaderRect) {
  const x = view.width / 2,
    y = Math.min(
      view.height / 2,
      Math.max(0, page.top + page.height / 2 - view.top),
    );
  return {
    x,
    y,
    viewWidth: view.width,
    viewHeight: view.height,
    pageX: Math.max(0, Math.min(1, (view.left + x - page.left) / page.width)),
    pageY: Math.max(0, Math.min(1, (view.top + y - page.top) / page.height)),
  };
}
export function readerAnchorScroll(
  anchor: ReturnType<typeof captureReaderAnchor>,
  view: ReaderRect,
  page: ReaderRect,
  left: number,
  top: number,
) {
  return {
    left: Math.max(
      0,
      left +
        page.left +
        page.width * anchor.pageX -
        view.left -
        (anchor.x * view.width) / anchor.viewWidth,
    ),
    top: Math.max(
      0,
      top +
        page.top +
        page.height * anchor.pageY -
        view.top -
        (anchor.y * view.height) / anchor.viewHeight,
    ),
  };
}
