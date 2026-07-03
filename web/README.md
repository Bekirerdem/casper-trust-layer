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

`CSPR_CLOUD_TOKEN` (cspr.cloud) enables live RPC reads; without it the UI falls back to the committed snapshot.

## Deploy

Deployed on Vercel: `vercel --prod` from this directory (auto-deploy is not wired).
