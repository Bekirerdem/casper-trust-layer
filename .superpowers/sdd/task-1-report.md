# Task 1 Report: AgentTreasury Module Scaffold

## Status: DONE_WITH_CONCERNS

## What was implemented

- `contracts/src/treasury.rs` (new, 201 lines):
  - `MS_PER_DAY: u64 = 86_400_000` constant
  - `ReservationState` enum (`Open`, `Released`, `Refunded`)
  - `Reservation` struct (`payee: u32`, `amount: U256`, `task_id: u64`, `deadline: u64`, `state: ReservationState`)
  - `Error` enum, 11 variants (discriminants 1–11)
  - `AgentTreasury` module with 14 state fields
  - `impl AgentTreasury`: `init`, `admin`, `agent_address`, `limits`
  - Event structs: `Paid`, `Reserved`, `Released`, `Refunded`
  - Inline `#[cfg(test)] mod tests` with `init_stores_config`

- `contracts/src/lib.rs`: added `pub mod treasury;` after `pub mod reputation;`

## TDD Evidence

### RED — compile failure (test written before module)

Command:
```
wsl -d Ubuntu -- bash -lc "cd /mnt/c/.../contracts && cargo odra test -- treasury::tests::init_stores_config"
```
Output (key excerpt):
```
error[E0432]: unresolved imports `super::AgentTreasury`, `super::AgentTreasuryHostRef`, `super::AgentTreasuryInitArgs`
error: could not compile `contracts` (lib test) due to 1 previous error
```
Why expected: type names don't exist yet.

### GREEN — test passes after module is written

Command:
```
wsl -d Ubuntu -- bash -lc "cd /mnt/c/.../contracts && cargo odra test -- treasury::tests::init_stores_config"
```
Output:
```
test treasury::tests::init_stores_config ... ok
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 30 filtered out; finished in 0.01s
```

### Full suite (no regressions)
```
test result: ok. 31 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.61s
```
(30 original tests + 1 new = 31 total)

## Files changed

- `contracts/src/treasury.rs` — created
- `contracts/src/lib.rs` — +1 line

## Self-review findings

- All state fields, types, error variants, event structs, and method signatures match the brief verbatim.
- YAGNI: cross-contract `ContractRef` imports omitted — they are not used in Task 1 and would trigger the ICE (see Concerns).
- `#[allow(dead_code)]` on `World` struct per test-world pattern in existing contracts.
- Public names match brief exactly.

## Concerns

### Nightly compiler ICE — workaround applied

The nightly toolchain (`rustc 1.94.0-nightly 2025-12-31`) has a bug in `annotate_snippets::renderer::styled_buffer::StyledBuffer::replace` ("slice index starts at 9 but ends at 8") that fires during the `check_mod_deathness` (dead-code liveness) pass when it tries to emit warnings about items in the treasury module. The ICE also blocks compilation of all other modules in the crate.

**Workaround:** `#![allow(dead_code)]` at the top of `treasury.rs`. This suppresses dead-code warnings for the module, preventing the ICE.

**Implication:** All 14 state fields are scaffold fields for Tasks 2–5. Suppressing dead-code warnings is appropriate. The `#![allow(dead_code)]` should be removed in a cleanup pass once all tasks are complete and all fields are used.

### Deviation from brief's use block

The brief lists `use crate::identity::IdentityRegistryContractRef`, `use crate::reputation::ReputationEngineContractRef`, `use odra::ContractRef`, and `use odra_modules::cep18_token::Cep18ContractRef` at the module top. These are used in Tasks 3–5 but not in Task 1. They were omitted to avoid unused-import warnings that would trigger the ICE. They should be added when the relevant tasks implement the methods that call them.

## Fix: ICE workaround scope

**Review findings addressed (2026-06-23):**
1. File-level `#![allow(dead_code)]` was too broad — hides future genuine dead code.
2. The 4 brief-specified cross-contract imports were omitted; reviewer required them present or an empirical justification.

**Empirical test sequence:**

### Case 1 tested first — item-level allows + all 4 imports present

Applied:
- Removed file-level `#![allow(dead_code)]`
- Added item-level `#[allow(dead_code)]` above the `AgentTreasury` struct
- Added item-level `#[allow(dead_code)]` above the `MS_PER_DAY` const
- Added all 4 brief-specified imports with per-`use` `#[allow(unused_imports)]`

Compiler output (no ICE):
```
warning: `odra-casper-rpc-client` (lib) generated 1 warning   ← pre-existing vendor warning only
Finished `test` profile [unoptimized + debuginfo] target(s) in 19.30s
test treasury::tests::init_stores_config ... ok
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 30 filtered out; finished in 0.01s
```

**Result: Case 1 held.** No ICE, no warnings from the `contracts` crate. The nightly ICE was triggered by the original file-level allow interacting with specific warning-emission code paths, not by the items themselves. Item-level allows with per-use `#[allow(unused_imports)]` sidestep the problematic snippet renderer path.

**Final state of `treasury.rs`:**
- No file-level `#![allow(dead_code)]`
- `// Deferred cross-contract refs — first used in Tasks 3-5; present per brief's use-block.` comment above the 4 imports
- Each of the 4 deferred imports guarded by its own `#[allow(unused_imports)]`
- `#[allow(dead_code)]` on `MS_PER_DAY` const (used in Tasks 2+)
- `#[allow(dead_code)]` on `AgentTreasury` struct (scaffold fields used in Tasks 2-5)
- No other changes

**Full suite after fix:**
```
test result: ok. 31 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.54s
```

**Files changed in this fix:**
- `contracts/src/treasury.rs` — narrowed allows, added 4 deferred imports
