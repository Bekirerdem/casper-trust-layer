# Changelog

Changelog for `contracts`.

## [0.2.0] - 2026-10-21

v2 hardening from the October audit (see `docs/reputation-formula.md` §8). Not
storage-compatible with the v1 testnet deployment — redeploy. New storage fields
are appended after the v1 ones, so v1 field indices used by off-chain readers
stay the same.

### Changed
- `Escrow`: jobs need provider consent (`accept_job`); deadline must be 10 min –
  30 days out; `refund` only for accepted jobs and slashes 20% of the bond to the
  client; `claim` waits for the dispute window; fees accounted and withdrawable.
- `IdentityRegistry`: `slash(agent_id, to)` seizes `SLASH_BPS` and pays `to`;
  withdrawal is `request_withdraw` → (7 days) → `withdraw`, blocked while jobs are
  open; `transfer` is now a proposal completed by `accept_transfer`; URI ≤ 512 bytes.
- `ReputationEngine`: `score`/`get_summary` read 0 for slashed or withdrawn
  agents; dust settlements (`< min_job_amount`) and same-owner settlements earn
  nothing.
- `AgentTreasury` / `AgentVaults`: rolling 24h daily cap; payees must be active;
  whitelist entries void on identity transfer; limits sanity-checked.
- `AgentVaults`: each payment capped at `per_job` regardless of task id;
  `(vault, task)` key fixes the task-id truncation.
- Odra 2.8 → 2.9.1; vendored `odra-casper-rpc-client` rebased on 2.9.1 (the
  gas-tolerance patch is upstream now; address-from-effects and SSE watcher
  patches kept).

### Added
- `Escrow`: `accept_job`, `cancel_job`, `dispute`, `pause`/`unpause`,
  `withdraw_fees`, `transfer_admin`/`accept_admin`, `fees`, `is_paused`, `admin`.
- `IdentityRegistry`: `is_active`, `status_of`, `open_jobs`, `unbond_ready_at`,
  `request_withdraw`, `cancel_withdraw`, `accept_transfer`, `pending_owner`,
  `transfer_count`, `job_opened`/`job_closed` (escrow-only), admin handover,
  timelocked `propose_escrow`/`apply_escrow`.
- `ReputationEngine`: `set_min_job_amount`, `min_job_amount`, admin handover,
  timelocked escrow change.
- `AgentTreasury`: `set_agent`, `set_limits`, `withdraw`, `cancel_reservation`,
  `transfer_admin`/`accept_admin`, `spent_last_24h`.
- `AgentVaults`: `spent_last_24h`; events on `set_agent` and allow-list changes.
- 100 OdraVM tests (was 62), including a negative test per audit finding.

## [0.1.0] - 2026-06-24

### Added
- `IdentityRegistry` — ERC-8004-style agent identity with CSPR bond, slash, and status lifecycle.
- `Escrow` — agent-to-agent job state machine over CEP-18 (fund → submit → approve/claim/refund) with a 2% settlement fee retained in escrow.
- `ReputationEngine` — objective reputation derived from settled escrow jobs; anti-gaming formula (isqrt value concavity, saturating counterparty weight, per-edge cap, trust conservation, bonded cold-start) with an ERC-8004 `get_summary` read facade.
- `AgentTreasury` — bounded spend envelope (per-task + daily caps) with a contract-level whitelist-or-reputation gate and locked-funds escrow.
- `bin/cli.rs` — odra-cli deploy script (5 contracts + wiring) targeting `casper-test`.
- 62 OdraVM tests, including adversarial reputation cases (bought-edge, trust conservation).
