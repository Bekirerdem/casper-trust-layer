import type { ReactNode } from "react";

/** Bounded-card bento grid. Cells set their own `md:col-span-*` / `md:row-span-*`. */
export function BentoGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${className}`}>{children}</div>
  );
}

/** A single bento tile: hairline border, dark surface, generous padding. */
export function BentoCell({
  children,
  className = "",
  span = "",
}: {
  children: ReactNode;
  className?: string;
  span?: string;
}) {
  return (
    <div
      className={`border border-line bg-surface/40 p-6 md:p-8 ${span} ${className}`}
    >
      {children}
    </div>
  );
}
