import { useEffect, useState } from "react";

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
