import type { ReactNode } from "react";

const RATIOS: Record<string, string> = {
  "5/7": "lg:grid-cols-[5fr_7fr]",
  "7/5": "lg:grid-cols-[7fr_5fr]",
  "4/8": "lg:grid-cols-[4fr_8fr]",
  "3/2": "lg:grid-cols-[3fr_2fr]",
};

/** Asymmetric n/m split on 12 cols. `stickyLeft` pins the left column on scroll. */
export function SplitSection({
  left,
  right,
  ratio = "5/7",
  stickyLeft = false,
  className = "",
}: {
  left: ReactNode;
  right: ReactNode;
  ratio?: keyof typeof RATIOS | string;
  stickyLeft?: boolean;
  className?: string;
}) {
  const cols = RATIOS[ratio] ?? RATIOS["5/7"];
  return (
    <div className={`grid grid-cols-1 ${cols} gap-10 lg:gap-16 ${className}`}>
      <div className={stickyLeft ? "lg:sticky lg:top-28 lg:self-start" : ""}>{left}</div>
      <div>{right}</div>
    </div>
  );
}
