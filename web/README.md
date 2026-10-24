# Casper Trust Layer — Web

Next.js app for [casper-trust-layer.vercel.app](https://casper-trust-layer.vercel.app): the landing page and the **Trust Console** (`/app`) — a live dashboard over the on-chain agent registry with wallet-signed agent registration and live trust reads from `casper-test`.

## Structure

- `app/page.tsx` — landing (thesis, trust-gating, live console, on-chain proof)
- `app/app/` — Trust Console dashboard (agent registry, reputation detail, Casper Wallet connect)
- `app/api/trust/[agentId]` — live RPC read of an agent's reputation (no wallet needed)
- `app/api/register/*` — wallet-signed agent registration (server builds the tx, browser wallet signs, server submits)
- `lib/casper/` — read client over the `casper-trust` SDK · `lib/data/snapshot.json` — on-chain snapshot (refresh with `npm run snapshot`)

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run snapshot   # refresh snapshot.json from casper-test (needs CSPR_CLOUD_TOKEN in .env)
```

Reads go to the public `casper-test` node and need no token; if the RPC fails, the UI falls back to the committed snapshot.

`DEMO_SIGNER_PEM` — the PEM text of the demo signer (`sdk/scripts/seed-v2.mts`), the only key the server holds. It is the wallet of demo agents #0–#2 (signs their `accept_job` / `submit_work`), the treasury's delegated agent and the faucet's AGT stock. It administers nothing, and the server stops signing once it is down to 50 CSPR. Without it, reads work and the signing routes answer 500.

## Deploy

Deployed on Vercel: `vercel --prod` from this directory (auto-deploy is not wired).
