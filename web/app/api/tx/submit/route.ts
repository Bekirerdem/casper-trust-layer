import { relaySignedTransaction } from "@/lib/casper/relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Generic wallet-signed transaction submitter for the hire and vault flows.
export async function POST(req: Request) {
  return relaySignedTransaction(req);
}
