interface BadgeProps {
  variant: "casper" | "live";
  children: React.ReactNode;
}

export function Badge({ variant, children }: BadgeProps) {
  const isLive = variant === "live";

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide",
        isLive
          ? "bg-accent/10 text-accent border border-accent/30"
          : "bg-surface text-muted border border-border",
      ].join(" ")}
    >
      {isLive && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
        </span>
      )}
      {children}
    </span>
  );
}
