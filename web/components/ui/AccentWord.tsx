interface AccentWordProps {
  children: React.ReactNode;
}

/**
 * Renders a single word in --accent-red for use inside Zodiak headings.
 * Usage: <h1 className="font-display">Agent <AccentWord>Trust</AccentWord> Layer</h1>
 */
export function AccentWord({ children }: AccentWordProps) {
  return <span className="text-accent-red">{children}</span>;
}
