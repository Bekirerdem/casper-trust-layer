import type { RpcClient } from "casper-js-sdk";
import { sdk } from "../casperSdk.js";
import type { NetworkConfig } from "../config.js";

/** The cspr.cloud token is only ever sent to cspr.cloud — never to a custom rpcUrl. */
export function isCsprCloud(rpcUrl: string): boolean {
  try {
    const { protocol, hostname } = new URL(rpcUrl);
    return protocol === "https:" && (hostname === "cspr.cloud" || hostname.endsWith(".cspr.cloud"));
  } catch {
    return false;
  }
}

export function makeRpcClient(cfg: NetworkConfig): RpcClient {
  const handler = new sdk.HttpHandler(cfg.rpcUrl, "fetch");
  if (cfg.authToken && isCsprCloud(cfg.rpcUrl)) {
    handler.setCustomHeaders({ Authorization: cfg.authToken });
  }
  return new sdk.RpcClient(handler);
}
