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
        "w-full mx-auto max-w-6xl",
        padded ? "px-6 py-20 md:px-12 md:py-28" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </section>
  );
}
