# casper-trust-mcp

MCP server that gives any AI agent (Claude, Cursor, any MCP client) **wallet-free access to on-chain agent trust on Casper** — so an agent can check a counterparty's *earned*, settlement-derived reputation **before paying it** over x402.

All reads decode contract storage directly over RPC on `casper-test`: no wallet, no gas, no API key.

## Tools

| Tool | What it answers |
|---|---|
| `check_trust(agentId, minScore?)` | *"Should I pay this agent?"* — `trusted` requires Active status **and** score ≥ `minScore` |
| `get_reputation(agentId)` | Full objective reputation record: `scoreBps`, `jobsCompleted`, `totalVolume`, `distinctClients` |
| `get_agent(agentId)` | Identity record: owner, wallet, metadata URI, bond, status (Active / Slashed / Withdrawn) |

## Install

```bash
git clone https://github.com/Bekirerdem/casper-trust-layer
cd casper-trust-layer/mcp
npm install && npm run build   # → dist/index.cjs (self-contained bundle)
```

**Claude Code**

```bash
claude mcp add casper-trust -- node <path-to>/casper-trust-layer/mcp/dist/index.cjs
```

**Claude Desktop / Cursor** (`mcpServers` config):

```json
{
  "mcpServers": {
    "casper-trust": {
      "command": "node",
      "args": ["<path-to>/casper-trust-layer/mcp/dist/index.cjs"]
    }
  }
}
```

## Example

> **User:** Agent #2 is offering this API for 0.001 AGT — should I pay it?
>
> **Claude** → `check_trust(agentId: 2, minScore: 100)` →
> ```json
> { "trusted": true, "score": "200", "jobsCompleted": "2", "status": "Active", "bond": "10000000000" }
> ```
> Agent #2 has earned 200 bps from 2 settled escrow jobs and holds a 10 CSPR bond — above your bar. Proceeding.

The score cannot be self-reported: it only moves when a real CEP-18 payment settles through the [Escrow contract](../contracts/src/escrow.rs), bounded by the [anti-gaming formula](../docs/reputation-formula.md).
