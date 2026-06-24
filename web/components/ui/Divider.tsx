interface DividerProps {
  className?: string;
}

/**
 * Full-width hairline divider with the 1px accent-red signature.
 * Renders a `--line` hairline with a 1px red rule stacked on top.
 */
export function Divider({ className = "" }: DividerProps) {
  return (
    <div
      className={["w-full", className].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      <div className="w-full h-px bg-accent-red opacity-60" />
      <div className="w-full h-px border-t border-line" />
    </div>
  );
}
