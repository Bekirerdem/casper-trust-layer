import type { ReactNode } from "react";

/** 12-column grid wrapper. Cells assign their own `lg:col-span-*`. */
export function Grid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 ${className}`}>{children}</div>;
}
