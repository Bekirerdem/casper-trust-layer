interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

/** Uppercase Switzer label with wide tracking — e.g. "01 / PROTOCOL LAYER" */
export function SectionLabel({ children, className = "" }: SectionLabelProps) {
  return (
    <p
      className={[
        "text-xs font-sans uppercase tracking-[0.10em] text-muted",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </p>
  );
}
