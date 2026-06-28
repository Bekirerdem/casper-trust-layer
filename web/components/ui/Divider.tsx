interface DividerProps {
  className?: string;
}

/**
 * Premium subtle gradient divider line.
 */
export function Divider({ className = "" }: DividerProps) {
  return (
    <div
      className={["w-full h-px bg-linear-to-r from-transparent via-white/5 to-transparent", className].filter(Boolean).join(" ")}
      aria-hidden="true"
    />
  );
}
