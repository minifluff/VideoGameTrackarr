import { useEffect, useRef } from "react";

// Click-and-drag to scroll, everywhere: hold the mouse button and drag, the content
// follows the pointer. Installed once in AppShell and PublicShell, so it covers every
// page including the dashboard — no per-page wiring.
//
// How it works: on a mouse pointerdown, walk up from the target to find the nearest
// element that can actually scroll in each direction (a dashboard carousel row, a
// table container, a dialog list, the sidebar nav, …). If none can scroll vertically,
// the page itself (window) is the vertical target, which is how dragging anywhere on
// an ordinary page scrolls the page. Dragging moves each target by the pointer delta,
// so the content sticks to the cursor.
//
// Deliberate non-goals, to keep this from fighting the rest of the UI:
// - Touch is left alone: a finger already drag-scrolls natively, and adding mouse-style
//   handling on top of it would double-scroll.
// - Form controls keep their own behaviour: a drag starting in an input, textarea,
//   select, editable text, or a slider is ignored, so sliders and text fields still work.
// - A plain click still works: only a drag past CLICK_THRESHOLD_PX suppresses the
//   click that follows it, so dragging a game card scrolls instead of opening it, while
//   tapping the same card still opens it. Anything can opt out with
//   data-drag-scroll="off" on an ancestor.
const CLICK_THRESHOLD_PX = 6;

function isInteractiveStart(target: Element): boolean {
  return (
    target.closest(
      'input, textarea, select, [contenteditable="true"], [role="slider"], .MuiSlider-root, [data-drag-scroll="off"]',
    ) !== null
  );
}

function canScrollX(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  return (
    (style.overflowX === "auto" || style.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 1
  );
}

function canScrollY(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  return (
    (style.overflowY === "auto" || style.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 1
  );
}

interface ScrollTargets {
  xTarget: HTMLElement | "window" | null;
  yTarget: HTMLElement | "window" | null;
}

function findScrollTargets(start: Element): ScrollTargets {
  let xTarget: ScrollTargets["xTarget"] = null;
  let yTarget: ScrollTargets["yTarget"] = null;
  let el: Element | null = start;
  while (el && el !== document.documentElement) {
    if (el instanceof HTMLElement) {
      // The page itself scrolls through the window, not through body/html scrollTop
      // (which is 0 in browsers that scroll the root element), so treat those as window.
      if (el === document.body) {
        if (xTarget === null && document.documentElement.scrollWidth > window.innerWidth + 1) {
          xTarget = "window";
        }
        if (yTarget === null && document.documentElement.scrollHeight > window.innerHeight + 1) {
          yTarget = "window";
        }
      } else {
        if (xTarget === null && canScrollX(el)) xTarget = el;
        if (yTarget === null && canScrollY(el)) yTarget = el;
      }
    }
    if (xTarget !== null && yTarget !== null) break;
    el = el.parentElement;
  }
  if (yTarget === null && document.documentElement.scrollHeight > window.innerHeight + 1) {
    yTarget = "window";
  }
  if (xTarget === null && document.documentElement.scrollWidth > window.innerWidth + 1) {
    xTarget = "window";
  }
  return { xTarget, yTarget };
}

export function useDragToScroll(): void {
  const suppressClickRef = useRef(false);
  const suppressClickListenerRef = useRef<((event: MouseEvent) => void) | null>(null);

  useEffect(() => {
    const clearSuppression = () => {
      suppressClickRef.current = false;
      if (suppressClickListenerRef.current) {
        window.removeEventListener("click", suppressClickListenerRef.current, true);
        suppressClickListenerRef.current = null;
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      // A previous drag whose pointerup produced no click (released outside the window)
      // must not swallow the next, unrelated click.
      clearSuppression();
      if (event.button !== 0 || event.pointerType !== "mouse") return;
      const target = event.target as Element | null;
      if (!target || !(target instanceof Element) || isInteractiveStart(target)) return;

      const { xTarget, yTarget } = findScrollTargets(target);
      if (xTarget === null && yTarget === null) return;

      let lastX = event.clientX;
      let lastY = event.clientY;
      let startX = event.clientX;
      let startY = event.clientY;
      let dragging = false;

      const onPointerMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - lastX;
        const dy = moveEvent.clientY - lastY;
        lastX = moveEvent.clientX;
        lastY = moveEvent.clientY;
        if (!dragging) {
          if (
            Math.abs(moveEvent.clientX - startX) < CLICK_THRESHOLD_PX &&
            Math.abs(moveEvent.clientY - startY) < CLICK_THRESHOLD_PX
          ) {
            return;
          }
          dragging = true;
          document.body.classList.add("drag-scrolling");
        }
        if (xTarget === "window") window.scrollBy(-dx, 0);
        else if (xTarget) xTarget.scrollLeft -= dx;
        if (yTarget === "window") window.scrollBy(0, -dy);
        else if (yTarget) yTarget.scrollTop -= dy;
      };

      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
        document.body.classList.remove("drag-scrolling");
        if (!dragging) return;
        // The click that follows a drag must not open the card/link the drag started on.
        suppressClickRef.current = true;
        const onClickCapture = (clickEvent: MouseEvent) => {
          if (suppressClickRef.current) {
            clickEvent.stopPropagation();
            clickEvent.preventDefault();
          }
          clearSuppression();
        };
        suppressClickListenerRef.current = onClickCapture;
        window.addEventListener("click", onClickCapture, true);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    };

    const onDragStart = (event: DragEvent) => {
      // Native image dragging (game covers are <img>) would show a ghost image over
      // the scroll; only suppress it while a drag-scroll is actually in progress.
      if (document.body.classList.contains("drag-scrolling")) event.preventDefault();
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("dragstart", onDragStart, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("dragstart", onDragStart, true);
      clearSuppression();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
