import { useState, useEffect } from "react";

/**
 * A custom hook that tracks the current window width and updates on resize.
 * Prevents "stale" width values read once at render time.
 */
export function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    
    // Initial sync
    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return width;
}
