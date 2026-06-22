interface StatProps {
  value: string;
  label: string;
  mono?: boolean;
}

export function Stat({ value, label, mono = true }: StatProps) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className={[
          "text-3xl font-semibold tracking-tight text-text",
          mono ? "font-mono" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </span>
      <span className="text-sm text-muted">{label}</span>
    </div>
  );
}
