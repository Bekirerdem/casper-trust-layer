# Changelog

Changelog for `contracts`.

## [0.1.0] - 2026-06-24

### Added
- `IdentityRegistry` — ERC-8004-style agent identity with CSPR bond, slash, and status lifecycle.
- `Escrow` — agent-to-agent job state machine over CEP-18 (fund → submit → approve/claim/refund) with a 2% settlement fee retained in escrow.
- `ReputationEngine` — objective reputation derived from settled escrow jobs; anti-gaming formula (isqrt value concavity, saturating counterparty weight, per-edge cap, trust conservation, bonded cold-start) with an ERC-8004 `get_summary` read facade.
- `AgentTreasury` — bounded spend envelope (per-task + daily caps) with a contract-level whitelist-or-reputation gate and locked-funds escrow.
- `bin/cli.rs` — odra-cli deploy script (5 contracts + wiring) targeting `casper-test`.
- 50 OdraVM tests, including adversarial reputation cases (bought-edge, trust conservation).
