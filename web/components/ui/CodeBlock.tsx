"use client";

import { useState } from "react";

interface CodeBlockProps {
  code: string;
  lang?: string;
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
    <div className="relative rounded-lg border border-border bg-surface overflow-hidden">
      {lang && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <span className="text-xs text-muted font-mono">{lang}</span>
          <button
            onClick={handleCopy}
            className="text-xs text-muted hover:text-text transition-colors"
            aria-label="Copy code"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
      {!lang && (
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 text-xs text-muted hover:text-text transition-colors"
          aria-label="Copy code"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      )}
      <pre className="overflow-x-auto p-4 text-sm font-mono text-text leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
