#!/usr/bin/env node
/**
 * casper-trust-mcp — MCP server over the casper-trust SDK.
 *
 * Gives any MCP-capable AI agent (Claude, Cursor, …) wallet-free access to
 * on-chain agent trust on Casper: check a counterparty's earned, settlement-
 * derived reputation BEFORE paying it over x402.
 *
 * All reads decode contract storage directly over RPC — no wallet, no gas,
 * no API key required.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createTrustClient, checkTrust, getReputation, getAgent } from "casper-trust";

const client = createTrustClient();

const asText = (value) => ({
  content: [
    {
      type: "text",
      text: JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2),
    },
  ],
});

const server = new McpServer({ name: "casper-trust", version: "0.1.0" });

server.registerTool(
  "check_trust",
  {
    title: "Check agent trust",
    description:
      "Gate decision for a Casper agent: is this counterparty trustworthy enough to pay? " +
      "Returns trusted (boolean, requires Active status and score ≥ minScore), the " +
      "settlement-derived score in basis points, jobs completed, status, and bond. " +
      "Call this BEFORE paying an agent over x402.",
    inputSchema: {
      agentId: z.number().int().min(0).describe("On-chain agent id (u32) from the IdentityRegistry"),
      minScore: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Minimum score in basis points the agent must have earned (e.g. 100)"),
    },
  },
  async ({ agentId, minScore }) => {
    const result = await checkTrust(
      client,
      agentId,
      minScore !== undefined ? { minScore: BigInt(minScore) } : {},
    );
    return asText(result);
  },
);

server.registerTool(
  "get_reputation",
  {
    title: "Get agent reputation",
    description:
      "Full reputation record of a Casper agent, derived from settled escrow payments " +
      "(objective — cannot be self-reported): scoreBps, jobsCompleted, totalVolume, " +
      "distinctClients, grantedOutBps.",
    inputSchema: {
      agentId: z.number().int().min(0).describe("On-chain agent id (u32)"),
    },
  },
  async ({ agentId }) => asText(await getReputation(client, agentId)),
);

server.registerTool(
  "get_agent",
  {
    title: "Get agent identity",
    description:
      "Identity record of a Casper agent from the ERC-8004-style registry: owner, wallet, " +
      "agentUri (metadata), bond, and status (Active | Slashed | Withdrawn). Returns null " +
      "if the id is not registered.",
    inputSchema: {
      agentId: z.number().int().min(0).describe("On-chain agent id (u32)"),
    },
  },
  async ({ agentId }) => asText(await getAgent(client, agentId)),
);

server.connect(new StdioServerTransport()).catch((e) => {
  console.error("casper-trust-mcp failed to start:", e);
  process.exit(1);
});
