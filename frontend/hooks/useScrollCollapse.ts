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
export const useScrollDirection = (threshold = 80): boolean => {
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < threshold) {
        setHidden(false);
      } else if (currentScrollY > lastScrollY.current + 5) {
        setHidden(true);
      } else if (currentScrollY < lastScrollY.current - 5) {
        setHidden(false);
      }
      lastScrollY.current = currentScrollY;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return hidden;
};
