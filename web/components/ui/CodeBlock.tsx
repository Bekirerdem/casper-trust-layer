"use client";

import { useState } from "react";

interface CodeBlockProps {
  code: string;
  lang?: string;
}

function CopyButton({
  onCopy,
  copied,
  className,
}: {
  onCopy: () => void;
  copied: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onCopy}
      className={`text-xs text-muted hover:text-text transition-colors ${className ?? ""}`}
      aria-label="Copy code"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export function CodeBlock({ code, lang }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="relative border border-line overflow-hidden" style={{ borderRadius: 0 }}>
      {lang ? (
        <div className="flex items-center justify-between px-4 py-2 border-b border-line bg-surface">
          <span className="text-xs text-muted font-mono">{lang}</span>
          <CopyButton onCopy={handleCopy} copied={copied} />
        </div>
      ) : (
        <CopyButton
          onCopy={handleCopy}
          copied={copied}
          className="absolute top-3 right-3"
        />
      )}
      <pre className="overflow-x-auto p-4 text-sm font-mono text-text leading-relaxed bg-surface">
        <code>{code}</code>
      </pre>
    </div>
  );
}
