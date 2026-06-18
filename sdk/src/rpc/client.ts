import { HttpHandler, RpcClient } from "casper-js-sdk";
import type { NetworkConfig } from "../config.js";

export function makeRpcClient(cfg: NetworkConfig): RpcClient {
  const handler = new HttpHandler(cfg.rpcUrl, "fetch");
  if (cfg.authToken) handler.setCustomHeaders({ Authorization: cfg.authToken });
  return new RpcClient(handler);
}
