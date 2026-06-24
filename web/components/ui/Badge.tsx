interface BadgeProps {
  variant: "casper" | "live";
  children: React.ReactNode;
}

export function Badge({ variant, children }: BadgeProps) {
  const isLive = variant === "live";

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium tracking-wide border",
        isLive
          ? "text-accent-red border-accent-red/30 bg-accent-red/5"
          : "text-muted border-line bg-transparent",
      ].join(" ")}
    >
      {isLive && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-red opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-red" />
        </span>
      )}
      {children}
    </span>
  );
}
