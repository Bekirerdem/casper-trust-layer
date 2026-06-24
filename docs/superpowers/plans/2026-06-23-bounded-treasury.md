# Bounded Treasury (`AgentTreasury`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 5th Odra contract — `AgentTreasury` — that lets a business deposit CEP-18 funds and delegate spending to an AI agent, with the *contract* enforcing per-task + daily caps and a payee gate (whitelist OR on-chain reputation threshold), plus locked-funds outcome-bound reservations.

**Architecture:** Faithful Casper/Odra port of PRISM's `treasury` contract (`~/Desktop/prism/contracts/treasury/src/lib.rs`), re-modeled from Soroban's `Address`-keyed payees to this repo's **agent-id (u32)** model. Reputation-gating becomes a real cross-call to the already-deployed `ReputationEngine.score(u32)`, so trust enforcement moves from the SDK to protocol level. Wallet resolution (id → CEP-18 recipient) goes through `IdentityRegistry.get_agent_wallet(u32)`. Builds in WSL2 (Casper native does not compile on Windows), deploys to `casper-test`.

**Tech Stack:** Rust + Odra 2.8.0 (`#[odra::module]`, `Var`, `Mapping`, `ContractRef`), `odra-modules` CEP-18, OdraVM tests (`cargo odra test`), wasm build (`cargo odra build`) + `odra-cli` livenet deploy.

## Global Constraints

- Odra `2.8.0`, `odra-modules 2.8.0`, edition 2021. Contract crate is `#![no_std]` (see `contracts/src/lib.rs`).
- **Money type is `U256`** (CEP-18 amounts), never `i128`. Use `U256::zero()` / `.is_zero()` / checked accumulation.
- **`self.env().get_block_time()` returns Unix MILLISECONDS**, not seconds. Day bucket = `get_block_time() / 86_400_000`. Reservation `deadline` values are MILLISECONDS. (This is the exact bug hit on the escrow `deadline` earlier — do not divide by `86_400`.)
- **Auth = caller comparison** (`self.env().caller()` vs stored `Var<Address>`), there is no Soroban `require_auth()`. `admin` is the deployer (`init` sets `admin = caller`); `agent` is a constructor param.
- Payees are **agent ids (`u32`)**, not addresses. Transfers resolve `id → wallet` via `IdentityRegistry.get_agent_wallet`.
- Cross-calls use the existing `ContractRef` types: `IdentityRegistryContractRef`, `ReputationEngineContractRef`, `Cep18ContractRef`.
- Checks-effects-interactions: record ledger state BEFORE the token transfer (Odra reverts roll back atomically).
- Code-quality rules (project standard): one responsibility per file, keep `treasury.rs` lean (~200 LOC of logic + tests), named exports, no dead code, no speculative config.
- Build + test run in **WSL2 Ubuntu** with source at `/mnt/c/Users/l3eki/Desktop/casper-trust-layer/contracts`, `binaryen` v130 on PATH. Windows cannot compile `casper-types`.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `contracts/src/treasury.rs` | The `AgentTreasury` module: state, policy admin, `pay`, reservations, views, cross-call helpers, unit tests | **Create** |
| `contracts/src/lib.rs` | Register the new module | **Modify** (add `pub mod treasury;`) |
| `contracts/Odra.toml` | Declare the contract for build/schema | **Modify** (add `[[contracts]] fqn = "treasury::AgentTreasury"`) |
| `contracts/bin/cli.rs` | Deploy + wire the treasury into the livenet deploy script | **Modify** |
| `DEPLOYMENT.md` | Record the deployed treasury package hash + verification tx | **Modify** (Task 7) |

**Reference files (read-only, port sources):**
- `~/Desktop/prism/contracts/treasury/src/lib.rs` — port source (Soroban original).
- `contracts/src/escrow.rs` — CEP-18 `transfer`, cross-call, `get_block_time`, event, test idioms to copy.
- `contracts/src/reputation.rs` — `score(u32) -> U256`, caller-auth helper idiom, `record_settlement` (used to seed scores in Task 4 tests).
- `contracts/src/identity.rs` — `get_agent_wallet(u32) -> Address`, `agent_exists`, `register`, `MIN_BOND`.

---

## Task 1: Module scaffold — state, types, `init`, config views

**Files:**
- Create: `contracts/src/treasury.rs`
- Modify: `contracts/src/lib.rs`
- Test: inline `#[cfg(test)] mod tests` in `contracts/src/treasury.rs`

**Interfaces:**
- Produces:
  - `AgentTreasury` module with `init(identity: Address, agent: Address, token: Address, daily_limit: U256, per_task_limit: U256)` (Odra generates `AgentTreasuryInitArgs { identity, agent, token, daily_limit, per_task_limit }` and `AgentTreasuryHostRef`).
  - Views: `admin(&self) -> Address`, `agent_address(&self) -> Address`, `limits(&self) -> (U256, U256)` (returns `(daily_limit, per_task_limit)`).
  - Types: `Reservation`, `ReservationState`, `Error` (full variant set declared now, used by later tasks).
  - State Vars/Mappings: `admin, agent, token, identity, daily_limit, per_task_limit, rep_registry, min_reputation` (`Var`), `whitelist, day_spent, task_spent, reservations` (`Mapping`), `next_reservation_id, locked` (`Var`).

- [ ] **Step 1: Add the module to `lib.rs`**

Modify `contracts/src/lib.rs` to add the module after `pub mod reputation;`:

```rust
#![cfg_attr(not(test), no_std)]
#![cfg_attr(not(test), no_main)]
extern crate alloc;

pub mod escrow;
pub mod identity;
pub mod reputation;
pub mod treasury;
```

- [ ] **Step 2: Write the failing test (config round-trips through deploy)**

Create `contracts/src/treasury.rs` with the test module first (it will not compile until the module exists — that is the failing state):

```rust
#[cfg(test)]
mod tests {
    use super::{AgentTreasury, AgentTreasuryHostRef, AgentTreasuryInitArgs};
    use crate::identity::{IdentityRegistry, IdentityRegistryHostRef};
    use odra::casper_types::U256;
    use odra::host::{Deployer, HostEnv, HostRef, NoArgs};
    use odra::prelude::{Address, Addressable};
    use odra_modules::cep18_token::{Cep18, Cep18HostRef, Cep18InitArgs};

    const SUPPLY: u64 = 1_000_000_000;
    const DAILY: u64 = 100_000;
    const PER_TASK: u64 = 40_000;

    struct World {
        env: HostEnv,
        identity: IdentityRegistryHostRef,
        token: Cep18HostRef,
        treasury: AgentTreasuryHostRef,
        admin: Address,
        agent: Address,
    }

    fn setup() -> World {
        let env = odra_test::env();
        let admin = env.get_account(0);
        let agent = env.get_account(1);

        env.set_caller(admin);
        let token = Cep18::deploy(
            &env,
            Cep18InitArgs {
                symbol: "AGT".to_string(),
                name: "Agent Credits".to_string(),
                decimals: 9,
                initial_supply: U256::from(SUPPLY),
            },
        );
        let identity = IdentityRegistry::deploy(&env, NoArgs);
        let treasury = AgentTreasury::deploy(
            &env,
            AgentTreasuryInitArgs {
                identity: identity.address(),
                agent,
                token: token.address(),
                daily_limit: U256::from(DAILY),
                per_task_limit: U256::from(PER_TASK),
            },
        );
        World { env, identity, token, treasury, admin, agent }
    }

    #[test]
    fn init_stores_config() {
        let w = setup();
        assert_eq!(w.treasury.admin(), w.admin);
        assert_eq!(w.treasury.agent_address(), w.agent);
        assert_eq!(w.treasury.limits(), (U256::from(DAILY), U256::from(PER_TASK)));
    }
}
```

- [ ] **Step 3: Run the test to verify it fails**

Run (in WSL2 Ubuntu):
```bash
cd /mnt/c/Users/l3eki/Desktop/casper-trust-layer/contracts
cargo odra test -- treasury::tests::init_stores_config
```
Expected: FAIL — compile error, `AgentTreasury` / `AgentTreasuryInitArgs` not found.

- [ ] **Step 4: Write the module (state + types + init + config views)**

Prepend to `contracts/src/treasury.rs` (above the test module):

```rust
use crate::identity::IdentityRegistryContractRef;
use crate::reputation::ReputationEngineContractRef;
use odra::casper_types::U256;
use odra::prelude::*;
use odra::ContractRef;
use odra_modules::cep18_token::Cep18ContractRef;

/// Casper `get_block_time()` returns Unix MILLISECONDS, so a UTC day bucket
/// divides by this (NOT 86_400). Reservation deadlines are milliseconds too.
const MS_PER_DAY: u64 = 86_400_000;

/// Lifecycle of a locked-funds reservation (outcome-bound payment).
#[odra::odra_type]
pub enum ReservationState {
    Open,
    Released,
    Refunded,
}

/// Funds reserved (locked, not transferred) for `payee` against `task_id`,
/// releasable by admin or refundable by the agent after `deadline` (ms).
#[odra::odra_type]
pub struct Reservation {
    pub payee: u32,
    pub amount: U256,
    pub task_id: u64,
    pub deadline: u64,
    pub state: ReservationState,
}

/// Error variants for the treasury.
#[odra::odra_error]
pub enum Error {
    /// Only the admin (fund owner) may change policy or release reservations.
    NotAdmin = 1,
    /// Only the delegated agent may trigger payments/reservations.
    NotAgent = 2,
    ZeroAmount = 3,
    /// Payee is neither whitelisted nor (no reputation policy) reputation-eligible.
    PayeeNotWhitelisted = 4,
    /// Reputation policy is active but the payee's score is below the threshold.
    BelowReputationThreshold = 5,
    ExceedsTaskLimit = 6,
    ExceedsDailyLimit = 7,
    InsufficientFreeBalance = 8,
    ReservationNotFound = 9,
    DeadlineNotReached = 10,
    /// Reservation already released or refunded.
    InvalidState = 11,
}

/// Non-custodial treasury: a business deposits CEP-18 funds and delegates
/// spending to an AI `agent`. The contract — not the model — enforces a payee
/// gate (whitelist OR earned reputation), a per-task cap, and a UTC daily cap.
/// Spend is accounted per task. Reservations lock funds for outcome-bound work.
#[odra::module(errors = Error, events = [Paid, Reserved, Released, Refunded])]
pub struct AgentTreasury {
    admin: Var<Address>,
    agent: Var<Address>,
    token: Var<Address>,
    identity: Var<Address>,
    daily_limit: Var<U256>,
    per_task_limit: Var<U256>,
    rep_registry: Var<Address>,
    min_reputation: Var<U256>,
    whitelist: Mapping<u32, bool>,
    day_spent: Mapping<u64, U256>,
    task_spent: Mapping<u64, U256>,
    reservations: Mapping<u64, Reservation>,
    next_reservation_id: Var<u64>,
    locked: Var<U256>,
}

#[odra::module]
impl AgentTreasury {
    /// Atomic init at deploy. The deployer becomes `admin`; `agent` is the
    /// delegated wallet allowed to call `pay` / `create_reservation`.
    pub fn init(
        &mut self,
        identity: Address,
        agent: Address,
        token: Address,
        daily_limit: U256,
        per_task_limit: U256,
    ) {
        self.admin.set(self.env().caller());
        self.agent.set(agent);
        self.token.set(token);
        self.identity.set(identity);
        self.daily_limit.set(daily_limit);
        self.per_task_limit.set(per_task_limit);
    }

    // ---- config views ----------------------------------------------------------

    pub fn admin(&self) -> Address {
        self.admin.get().unwrap_or_revert(self)
    }

    pub fn agent_address(&self) -> Address {
        self.agent.get().unwrap_or_revert(self)
    }

    pub fn limits(&self) -> (U256, U256) {
        (
            self.daily_limit.get_or_default(),
            self.per_task_limit.get_or_default(),
        )
    }
}

/// Emitted on a direct payment.
#[odra::event]
pub struct Paid {
    pub task_id: u64,
    pub payee: u32,
    pub amount: U256,
}

/// Emitted when funds are reserved (locked) for outcome-bound work.
#[odra::event]
pub struct Reserved {
    pub id: u64,
    pub payee: u32,
    pub amount: U256,
}

/// Emitted when a reservation is released (paid out).
#[odra::event]
pub struct Released {
    pub id: u64,
    pub payee: u32,
    pub amount: U256,
}

/// Emitted when a reservation is refunded back to free balance.
#[odra::event]
pub struct Refunded {
    pub id: u64,
    pub payee: u32,
    pub amount: U256,
}
```

> Note: `Paid`/`Reserved`/`Released`/`Refunded` are declared in the `events = [...]` attribute now so the module compiles; they are emitted in Tasks 3 and 5.

- [ ] **Step 5: Run the test to verify it passes**

Run:
```bash
cd /mnt/c/Users/l3eki/Desktop/casper-trust-layer/contracts
cargo odra test -- treasury::tests::init_stores_config
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add contracts/src/treasury.rs contracts/src/lib.rs
git commit -m "feat(contracts): scaffold AgentTreasury module — state, init, config views"
```

---

## Task 2: Whitelist + admin authorization

**Files:**
- Modify: `contracts/src/treasury.rs`
- Test: inline tests in `contracts/src/treasury.rs`

**Interfaces:**
- Consumes: `AgentTreasury` state from Task 1.
- Produces:
  - `add_payee(&mut self, agent_id: u32)` (admin-only), `remove_payee(&mut self, agent_id: u32)` (admin-only).
  - `is_payee(&self, agent_id: u32) -> bool`.
  - Private helper `only_admin(&self)`.

- [ ] **Step 1: Write the failing tests**

Add to the `tests` module in `contracts/src/treasury.rs`:

```rust
    #[test]
    fn admin_can_whitelist_and_remove_payee() {
        let mut w = setup();
        w.env.set_caller(w.admin);
        w.treasury.add_payee(7);
        assert!(w.treasury.is_payee(7));
        w.treasury.remove_payee(7);
        assert!(!w.treasury.is_payee(7));
    }

    #[test]
    fn non_admin_cannot_whitelist() {
        let mut w = setup();
        w.env.set_caller(w.agent); // agent is not admin
        let result = w.treasury.try_add_payee(7);
        assert_eq!(result, Err(super::Error::NotAdmin.into()));
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
cd /mnt/c/Users/l3eki/Desktop/casper-trust-layer/contracts
cargo odra test -- treasury::tests::admin_can_whitelist_and_remove_payee treasury::tests::non_admin_cannot_whitelist
```
Expected: FAIL — `add_payee`/`remove_payee`/`is_payee` not found.

- [ ] **Step 3: Implement whitelist + `only_admin`**

Add these methods inside the `#[odra::module] impl AgentTreasury` block (after `limits`):

```rust
    /// Whitelist an agent id as an always-allowed payee. Admin-only.
    pub fn add_payee(&mut self, agent_id: u32) {
        self.only_admin();
        self.whitelist.set(&agent_id, true);
    }

    /// Remove an agent id from the whitelist. Admin-only.
    pub fn remove_payee(&mut self, agent_id: u32) {
        self.only_admin();
        self.whitelist.set(&agent_id, false);
    }

    pub fn is_payee(&self, agent_id: u32) -> bool {
        self.whitelist.get(&agent_id).unwrap_or(false)
    }
```

And add a private helper (still inside the same `impl` block — private `fn` is not exported in the ABI, matching `escrow.rs`):

```rust
    fn only_admin(&self) {
        if self.env().caller() != self.admin.get().unwrap_or_revert(self) {
            self.env().revert(Error::NotAdmin);
        }
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
cd /mnt/c/Users/l3eki/Desktop/casper-trust-layer/contracts
cargo odra test -- treasury::tests::admin_can_whitelist treasury::tests::non_admin_cannot_whitelist
```
Expected: PASS (both).

- [ ] **Step 5: Commit**

```bash
git add contracts/src/treasury.rs
git commit -m "feat(contracts): treasury payee whitelist with admin auth"
```

---

## Task 3: `pay` — caps, payee gate (whitelist), CEP-18 transfer

**Files:**
- Modify: `contracts/src/treasury.rs`
- Test: inline tests in `contracts/src/treasury.rs`

**Interfaces:**
- Consumes: whitelist + `only_admin` (Task 2), state (Task 1).
- Produces:
  - `pay(&mut self, task_id: u64, payee: u32, amount: U256)` (agent-only).
  - Views: `balance(&self) -> U256`, `day_spent(&self) -> U256`, `task_spent(&self, task_id: u64) -> U256`.
  - Private helpers: `only_agent`, `assert_payee_allowed` (whitelist-only branch this task), `free_balance`, `agent_wallet`, `token_ref`, `identity_ref`, `today`.
  - Emits `Paid`.

- [ ] **Step 1: Write the failing tests**

The `pay` path resolves `payee → wallet` via the identity registry, so tests must register an agent and fund the treasury. Add a helper and tests to the `tests` module:

```rust
    use crate::identity::MIN_BOND;
    use odra::casper_types::U512;

    /// Registers an agent owned by the current caller and returns its id.
    fn register(identity: &mut IdentityRegistryHostRef, uri: &str) -> u32 {
        let mut bonded = identity.with_tokens(U512::from(MIN_BOND));
        bonded.register(uri.to_string())
    }

    /// Funds the treasury with `amount` AGT from the admin's supply.
    fn fund_treasury(w: &mut World, amount: u64) {
        w.env.set_caller(w.admin);
        w.token.transfer(&w.treasury.address(), &U256::from(amount));
    }

    #[test]
    fn agent_pays_whitelisted_payee_and_accounts_spend() {
        let mut w = setup();
        // Register a provider agent (wallet = account 2).
        let provider_wallet = w.env.get_account(2);
        w.env.set_caller(provider_wallet);
        let provider = register(&mut w.identity, "ipfs://provider");

        w.env.set_caller(w.admin);
        w.treasury.add_payee(provider);
        fund_treasury(&mut w, 100_000);

        w.env.set_caller(w.agent);
        w.treasury.pay(1, provider, U256::from(30_000u64));

        assert_eq!(w.token.balance_of(&provider_wallet), U256::from(30_000u64));
        assert_eq!(w.treasury.task_spent(1), U256::from(30_000u64));
        assert_eq!(w.treasury.day_spent(), U256::from(30_000u64));
    }

    #[test]
    fn pay_rejects_over_per_task_limit() {
        let mut w = setup();
        let provider_wallet = w.env.get_account(2);
        w.env.set_caller(provider_wallet);
        let provider = register(&mut w.identity, "ipfs://provider");
        w.env.set_caller(w.admin);
        w.treasury.add_payee(provider);
        fund_treasury(&mut w, 100_000);

        w.env.set_caller(w.agent);
        let result = w.treasury.try_pay(1, provider, U256::from(50_000u64)); // PER_TASK = 40_000
        assert_eq!(result, Err(super::Error::ExceedsTaskLimit.into()));
    }

    #[test]
    fn pay_rejects_over_daily_limit() {
        let mut w = setup();
        let provider_wallet = w.env.get_account(2);
        w.env.set_caller(provider_wallet);
        let provider = register(&mut w.identity, "ipfs://provider");
        w.env.set_caller(w.admin);
        w.treasury.add_payee(provider);
        fund_treasury(&mut w, 200_000);

        // DAILY = 100_000, PER_TASK = 40_000 -> three 40k tasks = 120k > daily
        w.env.set_caller(w.agent);
        w.treasury.pay(1, provider, U256::from(40_000u64));
        w.treasury.pay(2, provider, U256::from(40_000u64));
        let result = w.treasury.try_pay(3, provider, U256::from(40_000u64));
        assert_eq!(result, Err(super::Error::ExceedsDailyLimit.into()));
    }

    #[test]
    fn pay_rejects_non_agent_caller() {
        let mut w = setup();
        let provider_wallet = w.env.get_account(2);
        w.env.set_caller(provider_wallet);
        let provider = register(&mut w.identity, "ipfs://provider");
        w.env.set_caller(w.admin);
        w.treasury.add_payee(provider);
        fund_treasury(&mut w, 100_000);

        w.env.set_caller(w.admin); // admin is not the agent
        let result = w.treasury.try_pay(1, provider, U256::from(10_000u64));
        assert_eq!(result, Err(super::Error::NotAgent.into()));
    }

    #[test]
    fn pay_rejects_non_whitelisted_payee() {
        let mut w = setup();
        let provider_wallet = w.env.get_account(2);
        w.env.set_caller(provider_wallet);
        let provider = register(&mut w.identity, "ipfs://provider");
        // NOT whitelisted, no reputation policy.
        fund_treasury(&mut w, 100_000);

        w.env.set_caller(w.agent);
        let result = w.treasury.try_pay(1, provider, U256::from(10_000u64));
        assert_eq!(result, Err(super::Error::PayeeNotWhitelisted.into()));
    }

    #[test]
    fn pay_rejects_zero_amount() {
        let mut w = setup();
        let provider_wallet = w.env.get_account(2);
        w.env.set_caller(provider_wallet);
        let provider = register(&mut w.identity, "ipfs://provider");
        w.env.set_caller(w.admin);
        w.treasury.add_payee(provider);

        w.env.set_caller(w.agent);
        let result = w.treasury.try_pay(1, provider, U256::zero());
        assert_eq!(result, Err(super::Error::ZeroAmount.into()));
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
cd /mnt/c/Users/l3eki/Desktop/casper-trust-layer/contracts
cargo odra test -- treasury::tests::pay treasury::tests::agent_pays
```
Expected: FAIL — `pay`/`day_spent`/`task_spent` not found.

- [ ] **Step 3: Implement `pay` + supporting views/helpers**

Add to the `#[odra::module] impl AgentTreasury` block (after `is_payee`):

```rust
    /// The agent pays `amount` to `payee` (an agent id) for `task_id`. The
    /// contract enforces the payee gate, the per-task cap, the daily cap, and
    /// free-balance (reservations stay locked), then transfers to the payee's
    /// wallet. Reverts roll back the accounting atomically.
    pub fn pay(&mut self, task_id: u64, payee: u32, amount: U256) {
        self.only_agent();
        if amount.is_zero() {
            self.env().revert(Error::ZeroAmount);
        }
        self.assert_payee_allowed(payee);
        if amount > self.per_task_limit.get_or_default() {
            self.env().revert(Error::ExceedsTaskLimit);
        }
        let day = self.today();
        let spent_today = self.day_spent.get(&day).unwrap_or_default();
        if spent_today + amount > self.daily_limit.get_or_default() {
            self.env().revert(Error::ExceedsDailyLimit);
        }
        if self.free_balance() < amount {
            self.env().revert(Error::InsufficientFreeBalance);
        }

        // EFFECTS before INTERACTION.
        let task_spent = self.task_spent.get(&task_id).unwrap_or_default();
        self.day_spent.set(&day, spent_today + amount);
        self.task_spent.set(&task_id, task_spent + amount);

        let wallet = self.agent_wallet(payee);
        self.token_ref().transfer(&wallet, &amount);
        self.env().emit_event(Paid { task_id, payee, amount });
    }

    // ---- spend views -----------------------------------------------------------

    pub fn balance(&self) -> U256 {
        self.token_ref().balance_of(self.env().self_address())
    }

    pub fn day_spent(&self) -> U256 {
        self.day_spent.get(&self.today()).unwrap_or_default()
    }

    pub fn task_spent(&self, task_id: u64) -> U256 {
        self.task_spent.get(&task_id).unwrap_or_default()
    }
```

Add these private helpers (inside the same `impl` block):

```rust
    fn only_agent(&self) {
        if self.env().caller() != self.agent.get().unwrap_or_revert(self) {
            self.env().revert(Error::NotAgent);
        }
    }

    /// Whitelist OR earned-reputation gate. This task implements the
    /// whitelist-only branch; Task 4 adds the reputation branch.
    fn assert_payee_allowed(&self, payee: u32) {
        if self.whitelist.get(&payee).unwrap_or(false) {
            return;
        }
        self.env().revert(Error::PayeeNotWhitelisted);
    }

    fn today(&self) -> u64 {
        self.env().get_block_time() / MS_PER_DAY
    }

    /// Spendable balance: total balance minus funds locked by open reservations.
    fn free_balance(&self) -> U256 {
        self.balance() - self.locked.get_or_default()
    }

    fn agent_wallet(&self, agent_id: u32) -> Address {
        self.identity_ref().get_agent_wallet(agent_id)
    }

    fn token_ref(&self) -> Cep18ContractRef {
        Cep18ContractRef::new(self.env(), self.token.get().unwrap_or_revert(self))
    }

    fn identity_ref(&self) -> IdentityRegistryContractRef {
        IdentityRegistryContractRef::new(self.env(), self.identity.get().unwrap_or_revert(self))
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
cd /mnt/c/Users/l3eki/Desktop/casper-trust-layer/contracts
cargo odra test -- treasury::tests
```
Expected: PASS (Task 1–3 tests all green).

- [ ] **Step 5: Commit**

```bash
git add contracts/src/treasury.rs
git commit -m "feat(contracts): treasury pay with per-task/daily caps + CEP-18 transfer"
```

---

## Task 4: Reputation gate — `set_reputation_policy` + cross-call branch

**Files:**
- Modify: `contracts/src/treasury.rs`
- Test: inline tests in `contracts/src/treasury.rs`

**Interfaces:**
- Consumes: `assert_payee_allowed` (Task 3), `only_admin` (Task 2), `score(u32) -> U256` from `ReputationEngineContractRef`.
- Produces:
  - `set_reputation_policy(&mut self, registry: Address, min_reputation: U256)` (admin-only).
  - `get_reputation_policy(&self) -> Option<(Address, U256)>`.
  - Extends `assert_payee_allowed` so a non-whitelisted payee passes when its on-chain `score >= min_reputation`.

- [ ] **Step 1: Write the failing tests**

A scored agent is produced exactly like `reputation.rs` tests: deploy `ReputationEngine`, wire its escrow to a test account, and call `record_settlement` from that account. Add to the `tests` module:

```rust
    use crate::reputation::{ReputationEngine, ReputationEngineHostRef, ReputationEngineInitArgs};

    /// Deploys a reputation engine wired to `escrow_acct`, and returns it.
    fn deploy_reputation(w: &mut World, escrow_acct: Address) -> ReputationEngineHostRef {
        w.env.set_caller(w.admin);
        let mut rep = ReputationEngine::deploy(
            &w.env,
            ReputationEngineInitArgs { identity: w.identity.address() },
        );
        rep.set_escrow(escrow_acct);
        rep
    }

    #[test]
    fn high_reputation_payee_is_allowed_without_whitelist() {
        let mut w = setup();
        let escrow_acct = w.env.get_account(9);

        // Register provider + a funded client that will confer reputation.
        let provider_wallet = w.env.get_account(2);
        w.env.set_caller(provider_wallet);
        let provider = register(&mut w.identity, "ipfs://provider");
        let client_wallet = w.env.get_account(3);
        w.env.set_caller(client_wallet);
        let client = register(&mut w.identity, "ipfs://client");

        // Seed provider's score via a recorded settlement (bonded client floor).
        let mut rep = deploy_reputation(&mut w, escrow_acct);
        w.env.set_caller(escrow_acct);
        rep.record_settlement(provider, client, U256::from(1_000_000u64));
        let score = rep.score(provider);
        assert!(score > U256::zero());

        // Policy: threshold just at/under the earned score; provider NOT whitelisted.
        w.env.set_caller(w.admin);
        w.treasury.set_reputation_policy(rep.address(), score);
        fund_treasury(&mut w, 100_000);

        w.env.set_caller(w.agent);
        w.treasury.pay(1, provider, U256::from(10_000u64)); // allowed via reputation
        assert_eq!(w.token.balance_of(&provider_wallet), U256::from(10_000u64));
    }

    #[test]
    fn low_reputation_payee_is_rejected() {
        let mut w = setup();
        let escrow_acct = w.env.get_account(9);
        let provider_wallet = w.env.get_account(2);
        w.env.set_caller(provider_wallet);
        let provider = register(&mut w.identity, "ipfs://provider"); // score = 0

        let rep = deploy_reputation(&mut w, escrow_acct);
        w.env.set_caller(w.admin);
        w.treasury.set_reputation_policy(rep.address(), U256::from(1u64)); // min = 1
        fund_treasury(&mut w, 100_000);

        w.env.set_caller(w.agent);
        let result = w.treasury.try_pay(1, provider, U256::from(10_000u64));
        assert_eq!(result, Err(super::Error::BelowReputationThreshold.into()));
    }

    #[test]
    fn reputation_policy_round_trips() {
        let mut w = setup();
        let escrow_acct = w.env.get_account(9);
        let rep = deploy_reputation(&mut w, escrow_acct);
        w.env.set_caller(w.admin);
        w.treasury.set_reputation_policy(rep.address(), U256::from(500u64));
        assert_eq!(w.treasury.get_reputation_policy(), Some((rep.address(), U256::from(500u64))));
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
cd /mnt/c/Users/l3eki/Desktop/casper-trust-layer/contracts
cargo odra test -- treasury::tests::high_reputation treasury::tests::low_reputation treasury::tests::reputation_policy_round_trips
```
Expected: FAIL — `set_reputation_policy` / `get_reputation_policy` not found; `low_reputation` currently reverts `PayeeNotWhitelisted` not `BelowReputationThreshold`.

- [ ] **Step 3: Implement the reputation policy + extend the gate**

Add the entry points to the `#[odra::module] impl AgentTreasury` block (after `pay`):

```rust
    /// Opt-in reputation gate. With `min_reputation > 0`, a non-whitelisted payee
    /// can be paid when `ReputationEngine.score(payee) >= min_reputation`. Set
    /// `min_reputation = 0` to disable (whitelist-only). Admin-only.
    pub fn set_reputation_policy(&mut self, registry: Address, min_reputation: U256) {
        self.only_admin();
        self.rep_registry.set(registry);
        self.min_reputation.set(min_reputation);
    }

    pub fn get_reputation_policy(&self) -> Option<(Address, U256)> {
        self.rep_registry
            .get()
            .map(|r| (r, self.min_reputation.get_or_default()))
    }
```

Replace the Task-3 `assert_payee_allowed` body with the full whitelist-OR-reputation gate:

```rust
    /// Whitelist OR earned-reputation gate. A whitelisted payee always passes.
    /// Otherwise, when a reputation policy is set (`min > 0`), the payee passes
    /// iff its on-chain score meets the threshold.
    fn assert_payee_allowed(&self, payee: u32) {
        if self.whitelist.get(&payee).unwrap_or(false) {
            return;
        }
        let min = self.min_reputation.get_or_default();
        match self.rep_registry.get() {
            Some(reg) if min > U256::zero() => {
                let score = ReputationEngineContractRef::new(self.env(), reg).score(payee);
                if score < min {
                    self.env().revert(Error::BelowReputationThreshold);
                }
            }
            _ => self.env().revert(Error::PayeeNotWhitelisted),
        }
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
cd /mnt/c/Users/l3eki/Desktop/casper-trust-layer/contracts
cargo odra test -- treasury::tests
```
Expected: PASS (all treasury tests, including Task 3's `pay_rejects_non_whitelisted_payee` — still no policy set, so still `PayeeNotWhitelisted`).

- [ ] **Step 5: Commit**

```bash
git add contracts/src/treasury.rs
git commit -m "feat(contracts): treasury reputation gate via ReputationEngine cross-call"
```

---

## Task 5: Locked-funds reservations (create / release / refund)

**Files:**
- Modify: `contracts/src/treasury.rs`
- Test: inline tests in `contracts/src/treasury.rs`

**Interfaces:**
- Consumes: `only_admin`, `only_agent`, `assert_payee_allowed`, `free_balance`, `today`, `agent_wallet`, `token_ref`, `Reservation`, `ReservationState`.
- Produces:
  - `create_reservation(&mut self, task_id: u64, payee: u32, amount: U256, deadline: u64) -> u64` (agent-only).
  - `release_reservation(&mut self, id: u64)` (admin-only).
  - `refund_reservation(&mut self, id: u64)` (agent-only).
  - Views: `get_reservation(&self, id: u64) -> Option<Reservation>`, `locked(&self) -> U256`.
  - Emits `Reserved`, `Released`, `Refunded`.

- [ ] **Step 1: Write the failing tests**

Add to the `tests` module:

```rust
    use super::ReservationState;

    /// Whitelists `provider`, funds the treasury, and creates a reservation.
    fn reserve(w: &mut World, provider: u32, amount: u64, deadline: u64) -> u64 {
        w.env.set_caller(w.admin);
        w.treasury.add_payee(provider);
        w.env.set_caller(w.agent);
        w.treasury.create_reservation(1, provider, U256::from(amount), deadline)
    }

    #[test]
    fn create_reservation_locks_free_balance() {
        let mut w = setup();
        let provider_wallet = w.env.get_account(2);
        w.env.set_caller(provider_wallet);
        let provider = register(&mut w.identity, "ipfs://provider");
        fund_treasury(&mut w, 100_000);
        let deadline = w.env.block_time() + 1000;

        let id = reserve(&mut w, provider, 30_000, deadline);

        assert_eq!(w.treasury.locked(), U256::from(30_000u64));
        assert_eq!(w.treasury.balance(), U256::from(100_000u64)); // funds still held
        assert_eq!(w.treasury.get_reservation(id).unwrap().state, ReservationState::Open);
    }

    #[test]
    fn create_reservation_rejects_over_free_balance() {
        let mut w = setup();
        let provider_wallet = w.env.get_account(2);
        w.env.set_caller(provider_wallet);
        let provider = register(&mut w.identity, "ipfs://provider");
        fund_treasury(&mut w, 30_000);
        let deadline = w.env.block_time() + 1000;

        w.env.set_caller(w.admin);
        w.treasury.add_payee(provider);
        w.env.set_caller(w.agent);
        // first reservation locks 25k of 30k; second 25k exceeds free balance (5k)
        w.treasury.create_reservation(1, provider, U256::from(25_000u64), deadline);
        let result =
            w.treasury.try_create_reservation(2, provider, U256::from(25_000u64), deadline);
        assert_eq!(result, Err(super::Error::InsufficientFreeBalance.into()));
    }

    #[test]
    fn release_reservation_pays_and_accounts_daily() {
        let mut w = setup();
        let provider_wallet = w.env.get_account(2);
        w.env.set_caller(provider_wallet);
        let provider = register(&mut w.identity, "ipfs://provider");
        fund_treasury(&mut w, 100_000);
        let deadline = w.env.block_time() + 1000;
        let id = reserve(&mut w, provider, 30_000, deadline);

        w.env.set_caller(w.admin);
        w.treasury.release_reservation(id);

        assert_eq!(w.token.balance_of(&provider_wallet), U256::from(30_000u64));
        assert_eq!(w.treasury.locked(), U256::zero());
        assert_eq!(w.treasury.day_spent(), U256::from(30_000u64));
        assert_eq!(w.treasury.get_reservation(id).unwrap().state, ReservationState::Released);
    }

    #[test]
    fn refund_reservation_after_deadline_unlocks_without_paying() {
        let mut w = setup();
        let provider_wallet = w.env.get_account(2);
        w.env.set_caller(provider_wallet);
        let provider = register(&mut w.identity, "ipfs://provider");
        fund_treasury(&mut w, 100_000);
        let deadline = w.env.block_time() + 1000;
        let id = reserve(&mut w, provider, 30_000, deadline);

        w.env.advance_block_time(2000);
        w.env.set_caller(w.agent);
        w.treasury.refund_reservation(id);

        assert_eq!(w.token.balance_of(&provider_wallet), U256::zero()); // no payout
        assert_eq!(w.treasury.locked(), U256::zero()); // funds freed
        assert_eq!(w.treasury.get_reservation(id).unwrap().state, ReservationState::Refunded);
    }

    #[test]
    fn refund_reservation_rejected_before_deadline() {
        let mut w = setup();
        let provider_wallet = w.env.get_account(2);
        w.env.set_caller(provider_wallet);
        let provider = register(&mut w.identity, "ipfs://provider");
        fund_treasury(&mut w, 100_000);
        let deadline = w.env.block_time() + 1000;
        let id = reserve(&mut w, provider, 30_000, deadline);

        w.env.set_caller(w.agent);
        let result = w.treasury.try_refund_reservation(id);
        assert_eq!(result, Err(super::Error::DeadlineNotReached.into()));
    }

    #[test]
    fn release_reservation_rejects_non_admin() {
        let mut w = setup();
        let provider_wallet = w.env.get_account(2);
        w.env.set_caller(provider_wallet);
        let provider = register(&mut w.identity, "ipfs://provider");
        fund_treasury(&mut w, 100_000);
        let deadline = w.env.block_time() + 1000;
        let id = reserve(&mut w, provider, 30_000, deadline);

        w.env.set_caller(w.agent); // agent cannot release
        let result = w.treasury.try_release_reservation(id);
        assert_eq!(result, Err(super::Error::NotAdmin.into()));
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
cd /mnt/c/Users/l3eki/Desktop/casper-trust-layer/contracts
cargo odra test -- treasury::tests::create_reservation treasury::tests::release_reservation treasury::tests::refund_reservation
```
Expected: FAIL — reservation entry points not found.

- [ ] **Step 3: Implement the reservation lifecycle**

Add to the `#[odra::module] impl AgentTreasury` block (after `get_reputation_policy`):

```rust
    /// Agent reserves `amount` for `payee` against a future-delivered task. Funds
    /// stay in the treasury (locked, not transferred) until released by admin or
    /// refunded by the agent after `deadline` (ms). Same payee gate + per-task cap
    /// as a direct payment; the daily cap is enforced at release (real outflow).
    pub fn create_reservation(
        &mut self,
        task_id: u64,
        payee: u32,
        amount: U256,
        deadline: u64,
    ) -> u64 {
        self.only_agent();
        if amount.is_zero() {
            self.env().revert(Error::ZeroAmount);
        }
        self.assert_payee_allowed(payee);
        if amount > self.per_task_limit.get_or_default() {
            self.env().revert(Error::ExceedsTaskLimit);
        }
        if self.free_balance() < amount {
            self.env().revert(Error::InsufficientFreeBalance);
        }

        let id = self.next_reservation_id.get_or_default();
        self.reservations.set(
            &id,
            Reservation { payee, amount, task_id, deadline, state: ReservationState::Open },
        );
        self.next_reservation_id.set(id + 1);
        self.locked.set(self.locked.get_or_default() + amount);

        self.env().emit_event(Reserved { id, payee, amount });
        id
    }

    /// Admin approves delivery → release locked funds to the payee. The daily cap
    /// is enforced here (the real moment of outflow) and accounted per task.
    pub fn release_reservation(&mut self, id: u64) {
        self.only_admin();
        let mut r = self.load_reservation(id);
        if r.state != ReservationState::Open {
            self.env().revert(Error::InvalidState);
        }
        let day = self.today();
        let spent_today = self.day_spent.get(&day).unwrap_or_default();
        if spent_today + r.amount > self.daily_limit.get_or_default() {
            self.env().revert(Error::ExceedsDailyLimit);
        }

        // EFFECTS before INTERACTION.
        let task_spent = self.task_spent.get(&r.task_id).unwrap_or_default();
        self.day_spent.set(&day, spent_today + r.amount);
        self.task_spent.set(&r.task_id, task_spent + r.amount);
        self.locked.set(self.locked.get_or_default() - r.amount);
        let (payee, amount) = (r.payee, r.amount);
        r.state = ReservationState::Released;
        self.reservations.set(&id, r);

        let wallet = self.agent_wallet(payee);
        self.token_ref().transfer(&wallet, &amount);
        self.env().emit_event(Released { id, payee, amount });
    }

    /// After the deadline, the agent reclaims an undelivered reservation: the lock
    /// is released back to free balance. No transfer, no spend recorded.
    pub fn refund_reservation(&mut self, id: u64) {
        self.only_agent();
        let mut r = self.load_reservation(id);
        if r.state != ReservationState::Open {
            self.env().revert(Error::InvalidState);
        }
        if self.env().get_block_time() < r.deadline {
            self.env().revert(Error::DeadlineNotReached);
        }
        self.locked.set(self.locked.get_or_default() - r.amount);
        let (payee, amount) = (r.payee, r.amount);
        r.state = ReservationState::Refunded;
        self.reservations.set(&id, r);

        self.env().emit_event(Refunded { id, payee, amount });
    }

    pub fn get_reservation(&self, id: u64) -> Option<Reservation> {
        self.reservations.get(&id)
    }

    pub fn locked(&self) -> U256 {
        self.locked.get_or_default()
    }
```

Add the private loader helper (inside the same `impl` block):

```rust
    fn load_reservation(&self, id: u64) -> Reservation {
        self.reservations
            .get(&id)
            .unwrap_or_revert_with(self, Error::ReservationNotFound)
    }
```

- [ ] **Step 4: Run the full treasury test suite to verify it passes**

Run:
```bash
cd /mnt/c/Users/l3eki/Desktop/casper-trust-layer/contracts
cargo odra test -- treasury::tests
```
Expected: PASS (all treasury tests). Then run the whole suite to confirm no regression:
```bash
cargo odra test
```
Expected: PASS (previous 31 + new treasury tests).

- [ ] **Step 5: Commit**

```bash
git add contracts/src/treasury.rs
git commit -m "feat(contracts): treasury locked-funds reservations (create/release/refund)"
```

---

## Task 6: Wire `AgentTreasury` into the build + deploy CLI (build-only gate)

**Files:**
- Modify: `contracts/Odra.toml`
- Modify: `contracts/bin/cli.rs`

**Interfaces:**
- Consumes: `AgentTreasury` (Tasks 1–5), existing deploy script (`cli.rs`).
- Produces: a wasm-buildable + deployable treasury, wired with `set_reputation_policy(reputation, min)` in the deploy script.

- [ ] **Step 1: Declare the contract in `Odra.toml`**

Append to `contracts/Odra.toml`:

```toml
[[contracts]]
fqn = "treasury::AgentTreasury"
```

- [ ] **Step 2: Add the treasury to the deploy script**

Modify `contracts/bin/cli.rs`. Update the import line for the contracts crate:

```rust
use contracts::escrow::{Escrow, EscrowInitArgs};
use contracts::identity::IdentityRegistry;
use contracts::reputation::{ReputationEngine, ReputationEngineInitArgs};
use contracts::treasury::{AgentTreasury, AgentTreasuryInitArgs};
```

Inside `TrustLayerDeployScript::deploy`, after the escrow `set_escrow` wiring (after line `reputation.set_escrow(escrow.address());`) and before `Ok(())`, add:

```rust
        // Bounded treasury: the deployer is both admin (fund owner) and the
        // delegated agent for the demo (single funded key). Limits in token base
        // units (AGT decimals = 9). Reputation policy points at the live engine.
        let daily_limit = U256::from(500_000_000_000u64); // 500 AGT/day
        let per_task_limit = U256::from(100_000_000_000u64); // 100 AGT/task
        let deployer = env.caller();
        let mut treasury = AgentTreasury::load_or_deploy(
            env,
            AgentTreasuryInitArgs {
                identity: identity.address(),
                agent: deployer,
                token: token.address(),
                daily_limit,
                per_task_limit,
            },
            container,
            gas,
        )?;

        // Gate non-whitelisted payees on earned reputation (>= 1 bps suffices to
        // require a real settled score; tune per demo).
        env.set_gas(20_000_000_000u64);
        treasury.set_reputation_policy(reputation.address(), U256::from(1u64));
```

Register the contract in `main()` — add `.contract::<AgentTreasury>()` to the builder chain:

```rust
pub fn main() {
    OdraCli::new()
        .about("Casper Agent Trust Layer — deploy & interact")
        .deploy(TrustLayerDeployScript)
        .contract::<IdentityRegistry>()
        .contract::<ReputationEngine>()
        .contract::<Escrow>()
        .contract::<Cep18>()
        .contract::<AgentTreasury>()
        .build()
        .run();
}
```

> `env.caller()` on `HostEnv` returns the deployer account. If the exact method name differs in this `odra-cli` version, resolve the deployer the same way the existing script obtains accounts; the deployer is the livenet secret key from `.env`.

- [ ] **Step 3: Verify the wasm build compiles**

Run (in WSL2 Ubuntu, with binaryen on PATH):
```bash
cd /mnt/c/Users/l3eki/Desktop/casper-trust-layer/contracts
export PATH=~/binaryen-latest/bin:$PATH
cargo odra build
```
Expected: build succeeds; `wasm/AgentTreasury.wasm` is produced alongside the existing four. Also confirm the CLI binary compiles:
```bash
cargo build --bin contracts_cli
```
Expected: compiles with no errors.

- [ ] **Step 4: Confirm the test suite is still green**

Run:
```bash
cargo odra test
```
Expected: PASS (no regression).

- [ ] **Step 5: Commit**

```bash
git add contracts/Odra.toml contracts/bin/cli.rs
git commit -m "feat(contracts): wire AgentTreasury into build + livenet deploy script"
```

---

## Task 7: Testnet deploy + on-chain verification + DEPLOYMENT.md

**Files:**
- Modify: `DEPLOYMENT.md`
- (Runtime: WSL2 + funded `casper-test` key — produces real transactions, costs CSPR gas.)

**Interfaces:**
- Consumes: the wired deploy script (Task 6).
- Produces: a deployed `AgentTreasury` package on `casper-test`, a verified on-chain `pay`/reservation transaction, and updated deployment docs.

> This task runs on Bekir's machine in WSL2 against live testnet. It is not a unit test; the deliverable is a real package hash + a `cspr.live` transaction proving an on-chain gated payment. Reuses the existing deploy workarounds (auth proxy + vendored rpc-client patch) already documented in `DEPLOYMENT.md`.

- [ ] **Step 1: Build + deploy to testnet**

Run (in WSL2 Ubuntu):
```bash
cd /mnt/c/Users/l3eki/Desktop/casper-trust-layer/contracts
export PATH=~/binaryen-latest/bin:$PATH
cargo odra build
# start the cspr.cloud auth proxy (Odra 2.8.1 does not apply CSPR_CLOUD_AUTH_TOKEN):
CSPR_CLOUD_AUTH_TOKEN=<key> python3 ~/casper-proxy.py &
set -a; source .env; set +a
cargo run --bin contracts_cli -- deploy
```
Expected: `load_or_deploy` installs `AgentTreasury` (the existing four are loaded from the container, not re-deployed) and runs `set_reputation_policy`. Capture the new package hash + install tx hash from the output.

- [ ] **Step 2: Verify config on-chain (read-back)**

Query the deployed treasury (via `cargo run --bin contracts_cli -- ...` interact, or a `casper-client query-global-state` on the treasury package). Confirm `limits()` returns `(500000000000, 100000000000)` and `get_reputation_policy()` returns the live `ReputationEngine` package + `1`.
Expected: values match what the deploy script set.

- [ ] **Step 3: Produce a real gated payment transaction**

Using the deployer key (admin + agent), with the existing scored agent #0 (`scoreBps = 208`, from the snapshot work) as payee:
1. Fund the treasury: transfer some AGT from the deployer to the treasury package (CEP-18 `transfer`).
2. Call `treasury.pay(task_id, 0, amount)` where agent #0 is non-whitelisted but reputation-eligible (score 208 ≥ min 1).
3. Confirm a `Paid` event + an on-chain transfer to agent #0's wallet.

Expected: a successful `TransactionProcessed` on `casper-test`; record the tx hash. (Optionally demonstrate the REJECT path: `pay` to an unregistered/zero-score, non-whitelisted id → on-chain revert `BelowReputationThreshold`.)

- [ ] **Step 4: Update `DEPLOYMENT.md`**

Add a row to the "Deployed contracts" table and a note for the reputation-policy wiring:

```markdown
| **AgentTreasury** | `contract-package-<HASH>` | [`<txprefix>…`](https://testnet.cspr.live/deploy/<INSTALL_TX>) |
```
And under "Wiring (post-deploy)":
```markdown
| `AgentTreasury.set_reputation_policy(ReputationEngine, 1)` | [`<txprefix>…`](https://testnet.cspr.live/deploy/<POLICY_TX>) |
```
Add a one-line note: the treasury enforces per-task (100 AGT) + daily (500 AGT) caps and a reputation gate at the contract level, and record the verification `pay` tx hash.

- [ ] **Step 5: Commit**

```bash
git add DEPLOYMENT.md
git commit -m "docs: record AgentTreasury testnet deployment + reputation-gated pay verification"
```

---

## Self-Review

**Spec coverage (against `2026-06-23-trust-console-treasury.md` Bileşen 1):**
- `AgentTreasury` state (admin/agent/token/daily/per-task/rep-registry/min-reputation/DaySpent/TaskSpent/Reservation) → Tasks 1, 3, 5. ✅
- `pay(task_id, to, amount)` with whitelist-OR-reputation gate + per-task + daily caps, checks-effects-interactions → Tasks 3, 4. ✅
- `set_reputation_policy(registry, min)` admin opt-in → Task 4. ✅
- `create/release/refund_reservation` locked-funds escrow → Task 5. ✅ (decision: **included**, per Bekir.)
- Casper feasibility: `get_block_time` (ms), `Mapping`, `Cep18ContractRef`, `ReputationEngine` cross-call → Tasks 1, 3, 4, 5. ✅
- Build WSL2 + testnet deploy + verify + DEPLOYMENT.md → Tasks 6, 7. ✅
- Out of scope honored: no ZK, no Midnight, no cross-chain, no credit layer. ✅

**Port deltas from PRISM (intentional, documented):** payees are `u32` agent ids (not `Address`); money is `U256` (not `i128`); auth is caller-comparison (not `require_auth`); day bucket divides by `86_400_000` ms (not `86_400` s); `pay` additionally checks `free_balance` so reservations cannot be drained by a direct payment (a correctness improvement over the PRISM original).

**Placeholder scan:** No `TBD`/`implement later`/"add error handling". Task 7 carries `<HASH>`/`<TX>` placeholders by necessity — they are runtime outputs filled in after the live deploy, not unspecified design. The `env.caller()` deployer-resolution in Task 6 has an explicit fallback note.

**Type consistency:** `score(u32) -> U256` (reputation.rs:162), `get_agent_wallet(u32) -> Address` (identity.rs:136), `balance_of(Address) -> U256`, `transfer(&Address, &U256)` (escrow.rs:199) — all match usage. `AgentTreasuryInitArgs` field set `{identity, agent, token, daily_limit, per_task_limit}` is consistent across Tasks 1, 6. `ReservationState`/`Reservation`/`Error` variants referenced in Tasks 3–5 are all declared in Task 1.

---

## Out-of-plan follow-ups (next subsystems, not this plan)

Once the treasury is live and its package hash + entry-point names are fixed, write the **frontend plan** (`2026-06-23-trust-console.md`): Explorer + Playground + Treasury "hire an agent" flow with CSPR.click wallet (Bekir's chosen path), then landing link fixes + Midnight vision paragraph, then the demo video. The frontend plan depends on Task 7's deployed addresses, so it is deliberately deferred.
