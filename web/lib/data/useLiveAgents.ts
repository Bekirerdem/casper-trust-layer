"use client";

import { useEffect, useState } from "react";
import type { TrustSnapshot, AgentSnapshot } from "@/lib/casper/types";

export type LiveRep = { scoreBps: number; jobsCompleted: number };

/**
 * Live registry scores for the landing page, read once per visit from
 * /api/trust/all (server-cached). Returns {} until loaded and on RPC
 * failure, so every consumer falls back to the build-time snapshot.
 * Same merge contract as the Trust Console (TrustDashboard).
 */
export function useLiveAgents(): Record<number, LiveRep> {
  const [live, setLive] = useState<Record<number, LiveRep>>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/trust/all", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { agents?: (LiveRep & { agentId: number })[] }) => {
        if (cancelled || !d.agents) return;
        const next: Record<number, LiveRep> = {};
        for (const a of d.agents) {
          next[a.agentId] = { scoreBps: a.scoreBps, jobsCompleted: a.jobsCompleted };
        }
        setLive(next);
      })
      .catch(() => {
        /* keep snapshot values */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return live;
}

/**
 * Overlay live scores onto the snapshot: known agents get live values,
 * agents registered after the snapshot was captured are appended.
 */
export function mergeLiveAgents(
  snapshot: TrustSnapshot,
  live: Record<number, LiveRep>,
): TrustSnapshot {
  const agents: AgentSnapshot[] = snapshot.agents.map((a) => ({
    ...a,
    ...(live[a.agentId] ?? {}),
  }));
  for (const [idStr, rep] of Object.entries(live)) {
    const agentId = Number(idStr);
    if (!agents.some((a) => a.agentId === agentId)) {
      agents.push({ agentId, exists: true, ...rep });
    }
  }
  return { ...snapshot, agents };
}
