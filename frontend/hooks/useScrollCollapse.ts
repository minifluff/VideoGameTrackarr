import { useEffect, useRef, useState } from "react";

// Returns true when the page should collapse bulky headers. Directional: hides on
// scroll down past `threshold`, shows again on scroll up — so it doesn't flicker
// when hovering around the threshold like the old simple scrollY check did.
export const useScrollCollapse = (threshold = 140): boolean => {
  const [collapsed, setCollapsed] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < threshold) {
        setCollapsed(false);
      } else if (currentScrollY > lastScrollY.current + 5) {
        // Scrolling down — collapse
        setCollapsed(true);
      } else if (currentScrollY < lastScrollY.current - 5) {
        // Scrolling up — expand
        setCollapsed(false);
      }
      lastScrollY.current = currentScrollY;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return collapsed;
};
