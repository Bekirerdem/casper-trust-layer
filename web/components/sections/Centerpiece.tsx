"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  useReducedMotion,
} from "framer-motion";
import type { TrustSnapshot, SettlementProof } from "@/lib/casper/types";

// ── helpers ──────────────────────────────────────────────────────────────────

function shortHash(hash: string): string {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

function bpsToPercent(bps: number): string {
  return (bps / 100).toFixed(0) + "%";
}

// ── Score counter animated with framer useMotionValue ────────────────────────

function AnimatedScore({
  from,
  to,
  reduce,
  delay = 0,
}: {
  from: number;
  to: number;
  reduce: boolean;
  delay?: number;
}) {
  const mv = useMotionValue(reduce ? to : from);
  const display = useTransform(mv, (v) => bpsToPercent(Math.round(v)));
  const started = useRef(false);

  useEffect(() => {
    if (reduce || started.current) return;
    started.current = true;
    const controls = animate(mv, to, {
      delay,
      duration: 1.8,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [mv, to, delay, reduce]);

  return (
    <motion.span className="font-mono text-accent text-xl font-semibold tabular-nums">
      {display}
    </motion.span>
  );
}

// ── Single settlement row ────────────────────────────────────────────────────

function SettlementRow({
  proof,
  index,
  reduce,
}: {
  proof: SettlementProof;
  index: number;
  reduce: boolean;
}) {
  const delta = proof.scoreAfter - proof.scoreBefore;

  return (
    <motion.div
      className="flex items-center gap-3 py-3 border-b border-border last:border-0"
      initial={reduce ? false : { opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.4 + index * 0.25, duration: 0.5, ease: "easeOut" }}
    >
      {/* tx hash */}
      <span className="font-mono text-xs text-muted flex-1 truncate">
        {shortHash(proof.txHash)}
      </span>

      {/* agent ids */}
      <span className="text-xs text-muted whitespace-nowrap">
        Agent&nbsp;
        <span className="text-text font-medium">{proof.from}</span>
        &nbsp;→&nbsp;
        <span className="text-text font-medium">{proof.to}</span>
      </span>

      {/* amount */}
      <span className="font-mono text-xs text-muted whitespace-nowrap">
        {(Number(proof.amount) / 1_000_000_000).toFixed(3)} CSPR
      </span>

      {/* score delta — accent only if positive */}
      {delta !== 0 && (
        <span
          className={[
            "font-mono text-xs font-semibold whitespace-nowrap",
            delta > 0 ? "text-accent" : "text-muted",
          ].join(" ")}
        >
          {delta > 0 ? "+" : ""}
          {bpsToPercent(delta)}
        </span>
      )}
    </motion.div>
  );
}

// ── Agent node (SVG circle) ───────────────────────────────────────────────────

function AgentNode({
  agentId,
  scoreBps,
  isPayee,
  reduce,
}: {
  agentId: number;
  scoreBps: number;
  isPayee: boolean;
  reduce: boolean;
}) {
  // find the settlement that changed this agent's score
  const from = isPayee ? 0 : scoreBps;
  const to = scoreBps;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* circle */}
      <div
        className={[
          "relative flex h-14 w-14 items-center justify-center rounded-full border-2",
          isPayee
            ? "border-accent/60 bg-accent/5"
            : "border-border bg-surface",
        ].join(" ")}
      >
        {/* subtle ambient pulse on active agent (payee) */}
        {isPayee && !reduce && (
          <motion.div
            className="absolute inset-0 rounded-full border border-accent/30"
            animate={{ scale: [1, 1.18, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <span className="font-mono text-sm font-semibold text-text">
          A{agentId}
        </span>
      </div>

      {/* score */}
      <div className="flex flex-col items-center gap-0.5">
        <AnimatedScore from={from} to={to} reduce={reduce} delay={isPayee ? 0.8 : 0} />
        <span className="text-[10px] text-muted">trust score</span>
      </div>
    </div>
  );
}

// ── Payment flow arrow (SVG) ─────────────────────────────────────────────────

function FlowArrow({ reduce }: { reduce: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 pt-1">
      {/* line with travelling dot */}
      <div className="relative h-0.5 w-20 bg-border">
        {!reduce && (
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-accent"
            initial={{ left: 0 }}
            animate={{ left: "100%" }}
            transition={{
              delay: 0.6,
              duration: 0.9,
              ease: "easeInOut",
              repeat: Infinity,
              repeatDelay: 2.5,
            }}
          />
        )}
      </div>

      <span className="text-[9px] font-mono text-muted tracking-wider uppercase">
        x402 · CSPR
      </span>

      {/* arrowhead */}
      <svg width="10" height="6" viewBox="0 0 10 6" className="text-border -mt-1">
        <path d="M0 0 L5 6 L10 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

// ── Main Centerpiece export ──────────────────────────────────────────────────

interface CenterpieceProps {
  data: TrustSnapshot;
}

export function Centerpiece({ data }: CenterpieceProps) {
  const reduce = useReducedMotion() ?? false;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use the two agents and settlements from snapshot
  const agentPayer = data.agents.find((a) => a.agentId === 1) ?? data.agents[1];
  const agentPayee = data.agents.find((a) => a.agentId === 0) ?? data.agents[0];
  const settlements = data.settlements.slice(0, 3);

  return (
    <div
      className="relative flex flex-col gap-6 rounded-2xl border border-border bg-surface p-6"
      aria-label="Live trust-settlement visualization"
    >
      {/* header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-muted tracking-wider uppercase">
          {data.network}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-mono text-accent">
          <span className="relative flex h-1.5 w-1.5">
            {!reduce && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            )}
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          live
        </span>
      </div>

      {/* agent flow diagram */}
      <motion.div
        className="flex items-end justify-center gap-4"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        {agentPayer && (
          <AgentNode
            agentId={agentPayer.agentId}
            scoreBps={agentPayer.scoreBps}
            isPayee={false}
            reduce={reduce}
          />
        )}

        <div className="mb-7">
          <FlowArrow reduce={reduce} />
        </div>

        {agentPayee && (
          <AgentNode
            agentId={agentPayee.agentId}
            scoreBps={agentPayee.scoreBps}
            isPayee={true}
            reduce={reduce}
          />
        )}
      </motion.div>

      {/* settlement list */}
      <div className="flex flex-col">
        <span className="mb-1 text-[10px] font-mono text-muted tracking-wider uppercase">
          Recent settlements
        </span>
        {mounted &&
          settlements.map((s, i) => (
            <SettlementRow
              key={s.txHash}
              proof={s}
              index={i}
              reduce={reduce}
            />
          ))}
        {!mounted &&
          settlements.map((s) => (
            <div
              key={s.txHash}
              className="flex items-center gap-3 py-3 border-b border-border last:border-0"
            >
              <span className="font-mono text-xs text-muted">
                {shortHash(s.txHash)}
              </span>
            </div>
          ))}
      </div>

      {/* captured at */}
      <p className="text-[10px] font-mono text-muted/60 text-right -mt-2">
        snapshot {new Date(data.capturedAt).toISOString().slice(0, 10)}
      </p>
    </div>
  );
}
