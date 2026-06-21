import { defineConfig } from "vite";

// Standalone config for `npm run snapshot` (vite-node only).
// The published casper-trust + casper-js-sdk are CJS-bundled and break under
// Node's native ESM named-import resolution. ssr.noExternal forces Vite to
// transform them so the `import { HttpHandler } from "casper-js-sdk"` interop
// works. Not used by Next.js (Next reads next.config, not this file).
export default defineConfig({
  ssr: {
    noExternal: ["casper-trust", "casper-js-sdk"],
  },
});
