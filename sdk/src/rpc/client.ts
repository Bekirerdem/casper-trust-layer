import type { RpcClient } from "casper-js-sdk";
import { sdk } from "../casperSdk.js";
import type { NetworkConfig } from "../config.js";

export function makeRpcClient(cfg: NetworkConfig): RpcClient {
  const handler = new sdk.HttpHandler(cfg.rpcUrl, "fetch");
  if (cfg.authToken) handler.setCustomHeaders({ Authorization: cfg.authToken });
  return new sdk.RpcClient(handler);
}
