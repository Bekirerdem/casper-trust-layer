"use client";

import { useEffect, useRef } from "react";

/**
 * The mesh behind the page.
 *
 * It holds still until the pointer moves. Then the squares nearest the cursor
 * pick up the brand red, and the whole grid drifts a few pixels against the
 * direction of travel — enough to feel like a surface rather than wallpaper.
 *
 * Only two custom properties change per frame, both consumed by a mask and a
 * background-position, so nothing here triggers layout.
 */
export function LiveGrid() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;

    const paint = () => {
      frame = 0;
      el.style.setProperty("--mx", `${x}px`);
      el.style.setProperty("--my", `${y}px`);
      // Drift is a fraction of how far the pointer sits from centre, inverted,
      // so the mesh leans away from the cursor.
      el.style.setProperty("--gx", `${(0.5 - x / window.innerWidth) * 16}px`);
      el.style.setProperty("--gy", `${(0.5 - y / window.innerHeight) * 16}px`);
    };

    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };

    el.dataset.live = "true";
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return <div ref={ref} className="live-grid pointer-events-none fixed inset-0 z-0" aria-hidden="true" />;
}
