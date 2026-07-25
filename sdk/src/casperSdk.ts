import * as ns from "casper-js-sdk";

/**
 * casper-js-sdk ships CommonJS. Under plain Node ESM a named import from it
 * ("import { HttpHandler } from 'casper-js-sdk'") throws at load time —
 * `does not provide an export named 'HttpHandler'` — because Node cannot
 * statically analyse the CJS exports. A namespace import always resolves, so
 * every VALUE use in this SDK goes through `sdk` below.
 *
 * Bundlers (esbuild/webpack/vite) hand back the namespace itself; plain Node
 * hands back module.exports under `.default` — hence the fallback.
 *
 * Type-only imports stay direct (`import type { RpcClient } from "casper-js-sdk"`):
 * they are erased at compile time and never reach the loader.
 */
export const sdk = (ns as unknown as { default?: typeof ns }).default ?? ns;
