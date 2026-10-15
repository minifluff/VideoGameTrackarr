import { useEffect, useRef, useState } from "react";

// Returns true once the page is scrolled past `threshold` px. Used to collapse
// bulky page headers (title + description) into a compact sticky toolbar.
export const useScrollCollapse = (threshold = 140): boolean => {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setCollapsed(window.scrollY > threshold);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return collapsed;
};

// Directional scroll: returns true when scrolling down past `threshold`,
// false when scrolling up. Used for elements that should hide on scroll down
// but reappear on scroll up (e.g. search bars).
//
// Hiding/showing changes the document height, which fires scroll events from the
// layout shift itself. To avoid a feedback loop (toggle -> layout shift ->
// scroll event -> toggle...), scroll handling is rAF-throttled, requires a
// minimum 10px directional delta, and ignores events for 150ms after each toggle
// to let the layout settle.
export const useScrollDirection = (threshold = 80): boolean => {
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const settleUntil = useRef(0);
  const hiddenRef = useRef(false);

  useEffect(() => {
    let rafId = 0;
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const now = performance.now();
        if (now < settleUntil.current) {
          lastScrollY.current = window.scrollY;
          return;
        }
        const currentScrollY = window.scrollY;
        const delta = currentScrollY - lastScrollY.current;
        if (currentScrollY < threshold) {
          if (hiddenRef.current) {
            hiddenRef.current = false;
            setHidden(false);
            settleUntil.current = now + 150;
          }
        } else if (delta > 10) {
          if (!hiddenRef.current) {
            hiddenRef.current = true;
            setHidden(true);
            settleUntil.current = now + 150;
          }
        } else if (delta < -10) {
          if (hiddenRef.current) {
            hiddenRef.current = false;
            setHidden(false);
            settleUntil.current = now + 150;
          }
        }
        lastScrollY.current = currentScrollY;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, [threshold]);

  return hidden;
};
