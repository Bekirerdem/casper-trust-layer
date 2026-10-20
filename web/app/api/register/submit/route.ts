import { relaySignedTransaction } from "@/lib/casper/relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Submits the wallet-signed register transaction (same relay as /api/tx/submit).
export async function POST(req: Request) {
  return relaySignedTransaction(req);
}
