"use client";

import { useCallback, useEffect, useState } from "react";
import { runVaultAction, waitForVerdict, type VaultAction } from "@/lib/wallet/vaultActions";

type Vault = {
  vaultId: number;
  owner: string;
  agent: string;
  perJob: string;
  perDay: string;
  minTrackRecord: string;
  balance: string;
  frozen: boolean;
};

type Busy = { label: string; txHash?: string } | null;

const money = (motes: string, digits = 0) =>
  `$${(Number(motes) / 1e9).toLocaleString("en-US", { maximumFractionDigits: digits })}`;

const BLOCKED_BECAUSE: Record<string, string> = {
  "1": "only the account owner can do that",
  "2": "only the account's agent can spend",
  "4": "that account doesn't exist",
  "5": "this vendor has no completed jobs yet",
  "6": "it's more than one job is allowed to cost",
  "7": "it's more than today's total allows",
  "8": "there isn't enough in the account",
  "9": "you've frozen this account",
  "10": "you already have an account",
};

function reason(error?: string): string {
  const code = String(error ?? "").match(/User error: (\d+)/)?.[1];
  return (code && BLOCKED_BECAUSE[code]) || "your rules didn't allow it";
}

/** The account a customer opens, funds and controls. */
export function VaultDashboard({ publicKey }: { publicKey: string }) {
  const [vault, setVault] = useState<Vault | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Busy>(null);
  const [note, setNote] = useState<{ tone: "ok" | "bad"; text: string; txHash?: string } | null>(null);

  // Setup form
  const [perJob, setPerJob] = useState("100");
  const [perDay, setPerDay] = useState("500");
  const [requireRecord, setRequireRecord] = useState(true);
  const [amount, setAmount] = useState("50");

  const refresh = useCallback(async () => {
    try {
      const d = await fetch(`/api/vault?publicKey=${publicKey}`, { cache: "no-store" }).then((r) => r.json());
      setVault(d.vault ?? null);
    } catch {
      /* keep whatever we had */
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  async function run(label: string, action: VaultAction, successText: string) {
    setBusy({ label });
    setNote(null);
    try {
      const { txHash } = await runVaultAction(publicKey, action);
      setBusy({ label, txHash });
      const verdict = await waitForVerdict(txHash);
      if (verdict.ok) {
        setNote({ tone: "ok", text: successText, txHash });
        await refresh();
      } else {
        setNote({ tone: "bad", text: `Blocked — ${reason(verdict.error)}`, txHash });
      }
    } catch (e) {
      setNote({ tone: "bad", text: e instanceof Error ? e.message : "Something went wrong" });
    } finally {
      setBusy(null);
    }
  }

  const running = busy !== null;

  if (loading) {
    return (
      <section className="glass-panel bg-surface border-line rounded-2xl p-6 md:p-8 mt-6">
        <p className="font-sans text-sm text-muted">Looking for your account…</p>
      </section>
    );
  }

  // ---------- No account yet: open one ----------
  if (!vault) {
    return (
      <section className="glass-panel bg-surface border-accent-red/20 rounded-2xl p-6 md:p-8 mt-6">
        <h2 className="font-sans text-2xl font-black text-ink">Open your account</h2>
        <p className="font-sans text-sm text-muted mt-2 mb-6 max-w-[62ch] leading-relaxed">
          Set the limits your agent has to live inside. You can change them later, and you can
          freeze the account at any time.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <label className="flex flex-col gap-1.5">
            <span className="font-sans text-xs text-muted">Most it can spend on one job</span>
            <div className="flex items-center rounded-lg border border-line bg-subtle px-3">
              <span className="font-sans text-sm text-muted">$</span>
              <input
                value={perJob}
                onChange={(e) => setPerJob(e.target.value)}
                inputMode="decimal"
                className="w-full bg-transparent px-2 py-2.5 font-sans text-sm text-ink focus:outline-none"
              />
            </div>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-sans text-xs text-muted">Most it can spend in a day</span>
            <div className="flex items-center rounded-lg border border-line bg-subtle px-3">
              <span className="font-sans text-sm text-muted">$</span>
              <input
                value={perDay}
                onChange={(e) => setPerDay(e.target.value)}
                inputMode="decimal"
                className="w-full bg-transparent px-2 py-2.5 font-sans text-sm text-ink focus:outline-none"
              />
            </div>
          </label>
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-line bg-subtle p-4 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={requireRecord}
            onChange={(e) => setRequireRecord(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#E6212F]"
          />
          <span className="font-sans text-sm text-ink">
            Only pay vendors with completed jobs
            <span className="block text-xs text-muted mt-0.5">
              Unchecked, your agent can only pay vendors you approve by hand.
            </span>
          </span>
        </label>

        <button
          onClick={() =>
            run(
              "open",
              { action: "open", perJob, perDay, requireTrackRecord: requireRecord },
              "Your account is open.",
            )
          }
          disabled={running}
          className="inline-flex items-center gap-2.5 rounded-full bg-accent-red px-7 py-3 font-sans text-sm font-semibold text-bg transition-all duration-300 hover:bg-ink hover:text-bg disabled:opacity-50"
        >
          <span className={`h-1.5 w-1.5 rounded-full bg-current ${running ? "animate-ping" : ""}`} />
          {running ? "Confirm in your wallet…" : "Open account"}
        </button>

        {note && <Note note={note} />}
      </section>
    );
  }

  // ---------- The account ----------
  const spentToday = 0; // per-day usage is tracked on-chain; surfaced in Activity below
  return (
    <section className="flex flex-col gap-4 mt-6">
      <div className="glass-panel bg-surface border-line rounded-2xl p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-sans text-xs text-muted">Your account</span>
            <div className="flex items-baseline gap-3">
              <span className="font-sans text-4xl font-black tabular-nums text-ink">
                {money(vault.balance, 2)}
              </span>
              <span className="font-sans text-sm text-muted">available</span>
            </div>
          </div>

          <button
            onClick={() =>
              run(
                vault.frozen ? "unfreeze" : "freeze",
                vault.frozen ? { action: "unfreeze", vaultId: vault.vaultId } : { action: "freeze", vaultId: vault.vaultId },
                vault.frozen ? "Spending resumed." : "Spending frozen. Nothing can leave the account.",
              )
            }
            disabled={running}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-sans text-sm font-semibold transition-all duration-300 disabled:opacity-50 ${
              vault.frozen
                ? "bg-ink text-bg hover:bg-ok"
                : "border border-accent-red/40 text-accent-red hover:bg-accent-red hover:text-bg"
            }`}
          >
            {vault.frozen ? "Unfreeze" : "Freeze spending"}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {[
            { l: "Per job", v: money(vault.perJob) },
            { l: "Per day", v: money(vault.perDay) },
            {
              l: "Vendors",
              v: Number(vault.minTrackRecord) > 0 ? "Must have a record" : "Approved only",
            },
            { l: "Status", v: vault.frozen ? "Frozen" : "Active" },
          ].map((s) => (
            <div key={s.l} className="rounded-xl border border-line bg-subtle p-4">
              <div className="font-sans text-lg font-black text-ink">{s.v}</div>
              <div className="font-sans text-xs text-muted mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Money in / out */}
      <div className="glass-panel bg-surface border-line rounded-2xl p-6 md:p-8">
        <h3 className="font-sans text-sm font-bold text-ink mb-4">Add or take out money</h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-sans text-xs text-muted">Amount</span>
            <div className="flex items-center rounded-lg border border-line bg-subtle px-3">
              <span className="font-sans text-sm text-muted">$</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                className="w-28 bg-transparent px-2 py-2.5 font-sans text-sm text-ink focus:outline-none"
              />
            </div>
          </label>

          <button
            onClick={() => run("approve", { action: "approve", amount }, "Approved. Now add the money.")}
            disabled={running}
            className="rounded-lg border border-line bg-surface px-4 py-2.5 font-sans text-xs font-semibold text-ink transition-all hover:border-ink/30 disabled:opacity-50"
          >
            1 · Allow
          </button>
          <button
            onClick={() =>
              run("deposit", { action: "deposit", vaultId: vault.vaultId, amount }, "Money added.")
            }
            disabled={running}
            className="rounded-lg bg-ink px-4 py-2.5 font-sans text-xs font-semibold text-bg transition-all hover:bg-accent-red hover:text-bg disabled:opacity-50"
          >
            2 · Add
          </button>
          <button
            onClick={() =>
              run("withdraw", { action: "withdraw", vaultId: vault.vaultId, amount }, "Money returned to your wallet.")
            }
            disabled={running}
            className="rounded-lg border border-line px-4 py-2.5 font-sans text-xs text-muted transition-all hover:border-ink/30 hover:text-ink disabled:opacity-50"
          >
            Take out
          </button>
        </div>
        <p className="font-sans text-xs text-muted mt-3">
          Adding money takes two signatures: one to allow the account to hold it, one to move it.
        </p>
      </div>

      {busy?.txHash && (
        <p className="font-sans text-xs text-muted">
          Waiting for the network…{" "}
          <a
            href={`https://testnet.cspr.live/transaction/${busy.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-white/20 hover:text-ink"
          >
            receipt
          </a>
        </p>
      )}
      {note && <Note note={note} />}

      <p className="font-sans text-xs text-muted">
        Spent today is enforced by the contract on every payment; this account&apos;s ceiling is{" "}
        {money(vault.perDay)} and {spentToday === 0 ? "nothing has been spent yet today" : ""}.
      </p>
    </section>
  );
}

function Note({ note }: { note: { tone: "ok" | "bad"; text: string; txHash?: string } }) {
  return (
    <div className="mt-4 flex flex-col gap-1 font-sans text-sm">
      <span className={note.tone === "ok" ? "font-semibold text-ok" : "font-semibold text-accent-red"}>
        {note.text}
      </span>
      {note.txHash && (
        <a
          href={`https://testnet.cspr.live/transaction/${note.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted underline decoration-white/20 hover:text-ink"
        >
          See the receipt ↗
        </a>
      )}
    </div>
  );
}
