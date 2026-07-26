import { NextResponse } from "next/server";
import { Args, CLValue, ContractCallBuilder, Key, PublicKey } from "casper-js-sdk";
import { createReadClient } from "@/lib/casper/read";
import { VAULTS_PACKAGE } from "@/lib/casper/vaultRead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GAS = {
  open: 15_000_000_000,
  deposit: 15_000_000_000,
  approve: 5_000_000_000,
  simple: 5_000_000_000,
  pay: 15_000_000_000,
} as const;

type Action =
  | { action: "open"; perJob: string; perDay: string; requireTrackRecord: boolean }
  | { action: "approve"; amount: string }
  | { action: "deposit"; vaultId: number; amount: string }
  | { action: "withdraw"; vaultId: number; amount: string }
  | { action: "freeze"; vaultId: number }
  | { action: "unfreeze"; vaultId: number }
  | { action: "setRules"; vaultId: number; perJob: string; perDay: string; requireTrackRecord: boolean }
  | { action: "pay"; vaultId: number; payee: number; amount: string };

/** AGT has 9 decimals; the dashboard talks in whole units. */
const toMotes = (whole: string) => BigInt(Math.round(Number(whole) * 1e9)).toString();

/**
 * Builds an UNSIGNED transaction for a vault action.
 *
 * The customer's wallet signs these, never the server: it is their money and
 * their rules, so the signature has to come from them. Submit the signed result
 * through /api/tx/submit.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Action & { publicKeyHex: string };
    const { publicKeyHex } = body;
    if (!publicKeyHex) {
      return NextResponse.json({ error: "publicKeyHex required" }, { status: 400 });
    }

    const { cfg } = createReadClient();
    const from = PublicKey.fromHex(publicKeyHex);

    let entryPoint: string;
    let args: Args;
    let gas: number = GAS.simple;
    let pkg = VAULTS_PACKAGE;

    switch (body.action) {
      case "open": {
        // Owner spends through their own key by default — one less thing to
        // explain before the account exists.
        const self = Key.newKey(from.accountHash().toPrefixedString());
        entryPoint = "open_vault";
        args = Args.fromMap({
          agent: CLValue.newCLKey(self),
          per_job: CLValue.newCLUInt256(toMotes(body.perJob)),
          per_day: CLValue.newCLUInt256(toMotes(body.perDay)),
          min_track_record: CLValue.newCLUInt256(body.requireTrackRecord ? "1" : "0"),
        });
        gas = GAS.open;
        break;
      }
      case "approve": {
        // CEP-18 two-step: let the vaults contract move the deposit.
        pkg = cfg.packages.cep18;
        entryPoint = "approve";
        args = Args.fromMap({
          spender: CLValue.newCLKey(Key.newKey("hash-" + VAULTS_PACKAGE)),
          amount: CLValue.newCLUInt256(toMotes(body.amount)),
        });
        gas = GAS.approve;
        break;
      }
      case "deposit":
        entryPoint = "deposit";
        args = Args.fromMap({
          vault_id: CLValue.newCLUInt32(body.vaultId),
          amount: CLValue.newCLUInt256(toMotes(body.amount)),
        });
        gas = GAS.deposit;
        break;
      case "withdraw":
        entryPoint = "withdraw";
        args = Args.fromMap({
          vault_id: CLValue.newCLUInt32(body.vaultId),
          amount: CLValue.newCLUInt256(toMotes(body.amount)),
        });
        gas = GAS.deposit;
        break;
      case "freeze":
      case "unfreeze":
        entryPoint = body.action;
        args = Args.fromMap({ vault_id: CLValue.newCLUInt32(body.vaultId) });
        break;
      case "setRules":
        entryPoint = "set_rules";
        args = Args.fromMap({
          vault_id: CLValue.newCLUInt32(body.vaultId),
          per_job: CLValue.newCLUInt256(toMotes(body.perJob)),
          per_day: CLValue.newCLUInt256(toMotes(body.perDay)),
          min_track_record: CLValue.newCLUInt256(body.requireTrackRecord ? "1" : "0"),
        });
        break;
      case "pay":
        entryPoint = "pay";
        args = Args.fromMap({
          vault_id: CLValue.newCLUInt32(body.vaultId),
          task_id: CLValue.newCLUint64(String(Date.now())),
          payee: CLValue.newCLUInt32(body.payee),
          amount: CLValue.newCLUInt256(toMotes(body.amount)),
        });
        gas = GAS.pay;
        break;
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }

    const tx = new ContractCallBuilder()
      .from(from)
      .byPackageHash(pkg)
      .entryPoint(entryPoint)
      .runtimeArgs(args)
      .chainName(cfg.chainName)
      .payment(gas)
      .build();

    return NextResponse.json({ txJson: tx.toJSON(), hash: tx.hash.toHex() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "build failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
