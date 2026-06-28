"use client";

import { useEffect } from "react";
import Lenis from "lenis";

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 2.0,
    });

    let animationFrameId: number;

    function raf(time: number) {
      lenis.raf(time);
      animationFrameId = requestAnimationFrame(raf);
    }

    animationFrameId = requestAnimationFrame(raf);

    // Sync scroll triggers or anchors when lenis scrolls
    const handleAnchorScroll = (e: MouseEvent) => {
      const target = e.target as HTMLAnchorElement;
      if (target.tagName === "A" && target.hash && target.hash.startsWith("#")) {
        const element = document.querySelector(target.hash) as HTMLElement | null;
        if (element) {
          e.preventDefault();
          lenis.scrollTo(element);
        }
      }
    };
    document.addEventListener("click", handleAnchorScroll);

    return () => {
      cancelAnimationFrame(animationFrameId);
      lenis.destroy();
      document.removeEventListener("click", handleAnchorScroll);
    };
  }, []);

  return <>{children}</>;
}
