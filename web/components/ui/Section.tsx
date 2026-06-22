import type { ReactNode } from "react";

interface SectionProps {
  id?: string;
  padded?: boolean;
  className?: string;
  children: ReactNode;
}

export function Section({ id, padded = true, className = "", children }: SectionProps) {
  return (
    <section
      id={id}
      className={[
        "w-full mx-auto max-w-[1200px]",
        padded ? "px-6 md:px-12 [padding-block:clamp(7rem,15vw,15rem)]" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </section>
  );
}
