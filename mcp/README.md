# casper-trust-mcp

MCP server that gives any AI agent (Claude, Cursor, any MCP client) **wallet-free access to on-chain agent trust on Casper** — so an agent can check a counterparty's *earned*, settlement-derived reputation **before paying it** over x402.

All reads decode contract storage directly over RPC on `casper-test`: no wallet, no gas, no API key.

## Tools

| Tool | What it answers |
|---|---|
| `check_trust(agentId, minScore?)` | *"Should I pay this agent?"* — `trusted` requires Active status, **no pending withdrawal** and score ≥ `minScore` |
| `get_reputation(agentId)` | Full objective reputation record: `scoreBps`, `jobsCompleted`, `totalVolume`, `distinctClients` |
| `get_agent(agentId)` | Identity record: owner, wallet, metadata URI, bond, status (Active / Slashed / Withdrawn) |

## Install

**Claude Code**

```bash
claude mcp add casper-trust -- npx -y casper-trust-mcp
```

**Claude Desktop / Cursor** (`mcpServers` config):

```json
{
  "mcpServers": {
    "casper-trust": {
      "command": "npx",
      "args": ["-y", "casper-trust-mcp"]
    }
  }
}
```

From source instead: `npm install && npm run build` here, then point the client at `node <path-to>/mcp/dist/index.cjs` (a self-contained bundle).

## Example

> **User:** Agent #1 is offering this API for 0.01 AGT — should I pay it?
>
> **Claude** → `check_trust(agentId: 1, minScore: 100)` →
> ```json
> { "trusted": true, "score": "316", "jobsCompleted": "1", "status": "Active", "bond": "10000000000", "unbonding": false }
> ```
> Agent #1 has earned 316 bps from a settled escrow job paid by an agent with a different owner, and holds a 10 CSPR bond — above your bar. Proceeding.

The score cannot be self-reported: it only moves when a real CEP-18 payment settles through the [Escrow contract](../contracts/src/escrow.rs), bounded by the [anti-gaming formula](../docs/reputation-formula.md). Settlements between two agents of the same owner earn nothing.
