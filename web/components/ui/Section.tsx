import type { ReactNode } from "react";

interface SectionProps {
  id?: string;
  padded?: boolean;
  className?: string;
  children: ReactNode;
  /** Full-bleed (no max-width container) — for marquees / edge-to-edge bands. */
  bleed?: boolean;
  /** Dark (default) or a light "rhythm" section that inverts bg/text. */
  tone?: "dark" | "light";
}

export function Section({
  id,
  padded = true,
  className = "",
  children,
  bleed = false,
  tone = "dark",
}: SectionProps) {
  const toneCls = tone === "light" ? "bg-text text-bg" : "";
  return (
    <section
      id={id}
      className={[
        bleed ? "w-full" : "w-full mx-auto max-w-[1280px]",
        padded ? "px-6 md:px-12 [padding-block:clamp(6rem,10vw,10rem)]" : "",
        toneCls,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </section>
  );
}
