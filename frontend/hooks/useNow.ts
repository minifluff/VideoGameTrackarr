import { useEffect, useState } from "react";

/** The current time, re-rendered on an interval — keeps relative labels ("in 3 hours",
 * "2 hours ago") fresh without refetching anything. */
export function useNow(intervalMs = 60000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
