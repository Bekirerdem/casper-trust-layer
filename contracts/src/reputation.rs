use crate::identity::{AgentStatus, IdentityRegistryContractRef, MIN_BOND};
use odra::casper_types::{U256, U512};
use odra::prelude::*;
use odra::ContractRef;

// ---- Formula parameters (governance-tunable; see docs/reputation-formula.md) ----
const BPS: u64 = 10_000;
/// Below this sqrt-of-earned-score, a counterparty confers zero weight (sybil floor).
const T_MIN: u64 = 10;
/// At/above this, a counterparty confers full weight (honest saturation).
const T_SAT: u64 = 50;
/// Repeat-dampening floor — legitimate repeat business never drops to zero.
const DAMP_FLOOR_BPS: u64 = 2_000;
/// Base per-edge lifetime contribution cap (the bought-edge antidote).
const EDGE_CAP_BASE_BPS: u64 = 5_000;
/// Share of a grantor's earned score it may confer (trust conservation).
const GRANT_K_BPS: u64 = 5_000;
/// Bond-floor saturation ceiling in the rational curve.
const BOND_FLOOR_MAX_BP: u64 = 5_000;
/// Absolute cap on the newcomer bond-floor — bond can never buy full score.
const BOND_FLOOR_CAP_BPS: u64 = 1_000;
const MOTES_PER_CSPR: u64 = 1_000_000_000;

/// Objective, escrow-derived reputation for an agent. Reputation only exists if a
/// real payment settled, so it cannot be fabricated without burning value — the
/// wedge over canonical ERC-8004's subjective self-reported feedback.
#[odra::odra_type]
pub struct Reputation {
    pub jobs_completed: u64,
    pub total_volume: U256,
    pub distinct_clients: u32,
    /// Accumulated reputation, basis points (decimals = 4).
    pub score_bps: U256,
    /// Reputation this agent has conferred to others as a client (trust budget).
    pub granted_out_bps: U256,
}

/// Per-(provider, client) lifetime stats — backs repeat-dampening and the per-edge cap.
#[odra::odra_type]
pub struct PairStat {
    pub jobs: u32,
    pub contributed_bps: U256,
}

/// Error variants for the reputation engine.
#[odra::odra_error]
pub enum Error {
    /// Only the authorized escrow may record settlements.
    NotEscrow = 1,
    /// Only the admin may configure the engine.
    NotAdmin = 2,
    /// The escrow address has already been wired.
    EscrowAlreadySet = 3,
}

/// Derives reputation from escrow settlements via a sybil/collusion-resistant
/// formula (value × counterparty-weight × repeat-dampening, bounded by a per-edge
/// cap and trust conservation). Keyed by `agent_id` so reputation follows the
/// transferable identity (ERC-8004 model). All math is unsigned integer / bps, O(1).
#[odra::module(errors = Error, events = [SettlementRecorded])]
pub struct ReputationEngine {
    admin: Var<Address>,
    escrow: Var<Address>,
    /// IdentityRegistry — read live bond/status for the counterparty weight.
    identity: Var<Address>,
    reps: Mapping<u32, Reputation>,
    pairs: Mapping<(u32, u32), PairStat>,
}

#[odra::module]
impl ReputationEngine {
    pub fn init(&mut self, identity: Address) {
        self.admin.set(self.env().caller());
        self.identity.set(identity);
    }

    /// Wires the authorized escrow (one-time, admin only).
    pub fn set_escrow(&mut self, escrow: Address) {
        if self.env().caller() != self.admin.get().unwrap_or_revert(self) {
            self.env().revert(Error::NotAdmin);
        }
        if self.escrow.get().is_some() {
            self.env().revert(Error::EscrowAlreadySet);
        }
        self.escrow.set(escrow);
    }

    /// Called by the escrow when a job settles to `provider`, paid by `client_id`.
    /// Computes the bounded reputation delta and accrues it. Only the escrow.
    pub fn record_settlement(&mut self, provider: u32, client_id: u32, amount: U256) {
        if self.env().caller() != self.escrow.get().unwrap_or_revert(self) {
            self.env().revert(Error::NotEscrow);
        }

        let client = self.rep_of(client_id);
        let (client_bond, client_active) = self.client_bond_status(client_id);

        // (a) value — concave so whales and micro-job farming both flatten out.
        let v_bps = isqrt(amount);

        // (b) counterparty weight — earned-rep saturating ramp, with a bonded
        //     newcomer floor that breaks the cold-start multiply-by-zero deadlock.
        let earned_weight = counterparty_weight(client.score_bps);
        let bond_floor = if client_active && client_bond >= U512::from(MIN_BOND) {
            bond_floor_bps(client_bond)
        } else {
            U256::zero()
        };
        let from_bond_floor = bond_floor > earned_weight;
        let cp_weight = earned_weight.max(bond_floor);

        // (c) repeat dampening — per-pair harmonic decay, floored above zero.
        let mut pair = self.pair_of(provider, client_id);
        let damp_bps = u256(BPS / (1 + pair.jobs as u64)).max(u256(DAMP_FLOOR_BPS));

        // (d) raw delta (multiply-before-divide to avoid truncation-to-zero).
        let mut delta = v_bps * cp_weight / u256(BPS) * damp_bps / u256(BPS);

        // (e) per-edge lifetime cap — the bought-edge / star-topology antidote.
        let edge_cap = u256(EDGE_CAP_BASE_BPS) + bond_to_cap(client_bond);
        delta = delta.min(edge_cap.saturating_sub(pair.contributed_bps));

        // (f) trust conservation — an earning client cannot confer more than a
        //     share of what it earned. Bond-floor-sourced credit is exempt (it is
        //     a cold-start allowance, not minted from earned trust).
        if !from_bond_floor {
            let budget = client.score_bps * u256(GRANT_K_BPS) / u256(BPS);
            delta = delta.min(budget.saturating_sub(client.granted_out_bps));
        }

        // ---- accrue (O(1)) ----
        let mut prov = self.rep_of(provider);
        prov.score_bps += delta;
        prov.jobs_completed += 1;
        prov.total_volume += amount;
        if pair.jobs == 0 {
            prov.distinct_clients += 1;
        }
        self.reps.set(&provider, prov);

        pair.jobs += 1;
        pair.contributed_bps += delta;
        self.pairs.set(&(provider, client_id), pair);

        // Earned-sourced credit consumes the client's trust budget (client != provider
        // is enforced by the escrow, so no aliasing with the write above).
        if !from_bond_floor && !delta.is_zero() {
            let mut c = self.rep_of(client_id);
            c.granted_out_bps += delta;
            self.reps.set(&client_id, c);
        }

        self.env().emit_event(SettlementRecorded { provider, client_id, amount, delta_bps: delta });
    }

    // ---- views ----------------------------------------------------------------

    pub fn get_reputation(&self, provider: u32) -> Reputation {
        self.rep_of(provider)
    }

    pub fn score(&self, provider: u32) -> U256 {
        self.rep_of(provider).score_bps
    }

    /// ERC-8004-compatible read facade: `(count, summary_value, decimals)`.
    /// summary_value is accumulated reputation in basis points (decimals = 4).
    pub fn get_summary(&self, agent_id: u32) -> (u64, U256, u8) {
        let r = self.rep_of(agent_id);
        (r.jobs_completed, r.score_bps, 4u8)
    }

    pub fn pair_stat(&self, provider: u32, client_id: u32) -> PairStat {
        self.pair_of(provider, client_id)
    }

    // ---- internal -------------------------------------------------------------

    fn rep_of(&self, agent_id: u32) -> Reputation {
        self.reps.get(&agent_id).unwrap_or(Reputation {
            jobs_completed: 0,
            total_volume: U256::zero(),
            distinct_clients: 0,
            score_bps: U256::zero(),
            granted_out_bps: U256::zero(),
        })
    }

    fn pair_of(&self, provider: u32, client_id: u32) -> PairStat {
        self.pairs
            .get(&(provider, client_id))
            .unwrap_or(PairStat { jobs: 0, contributed_bps: U256::zero() })
    }

    fn client_bond_status(&self, client_id: u32) -> (U512, bool) {
        let id = IdentityRegistryContractRef::new(self.env(), self.identity.get().unwrap_or_revert(self));
        if !id.agent_exists(client_id) {
            return (U512::zero(), false);
        }
        let agent = id.get_agent(client_id);
        (agent.bond, matches!(agent.status, AgentStatus::Active))
    }
}

/// Emitted when the escrow reports a settled job to a provider.
#[odra::event]
pub struct SettlementRecorded {
    pub provider: u32,
    pub client_id: u32,
    pub amount: U256,
    pub delta_bps: U256,
}

// ---- pure helpers ----

fn u256(v: u64) -> U256 {
    U256::from(v)
}

/// Counterparty weight (bps) from a client's earned score: a saturating ramp on
/// `sqrt(score)` — zero below T_MIN, full at/above T_SAT.
fn counterparty_weight(client_score_bps: U256) -> U256 {
    let d = isqrt(client_score_bps);
    if d < u256(T_MIN) {
        U256::zero()
    } else if d >= u256(T_SAT) {
        u256(BPS)
    } else {
        (d - u256(T_MIN)) * u256(BPS) / u256(T_SAT - T_MIN)
    }
}

/// Bonded-newcomer floor: `min(CAP, bond * MAX_BP / (bond + K_BOND))`. Concave and
/// capped, so a bond opens participation but never buys full reputation.
fn bond_floor_bps(bond: U512) -> U256 {
    let raw = bond * U512::from(BOND_FLOOR_MAX_BP) / (bond + U512::from(MIN_BOND));
    let cap = U512::from(BOND_FLOOR_CAP_BPS);
    let v = if raw < cap { raw } else { cap };
    u256(v.as_u64())
}

/// Extends the per-edge cap by +1 bps per whole CSPR of bond above the minimum.
fn bond_to_cap(bond: U512) -> U256 {
    let excess = bond.saturating_sub(U512::from(MIN_BOND));
    let bps = excess / U512::from(MOTES_PER_CSPR);
    let capped = if bps > U512::from(1_000_000u64) { U512::from(1_000_000u64) } else { bps };
    u256(capped.as_u64())
}

/// Integer square root (Babylonian) over U256 — bounded iterations, float-free.
fn isqrt(n: U256) -> U256 {
    if n < u256(2) {
        return n;
    }
    let mut x = n;
    let mut y = (x + U256::one()) / u256(2);
    while y < x {
        x = y;
        y = (x + n / x) / u256(2);
    }
    x
}

#[cfg(test)]
mod tests {
    use super::{ReputationEngine, ReputationEngineHostRef};
    use crate::identity::{IdentityRegistry, IdentityRegistryHostRef, MIN_BOND};
    use odra::casper_types::{U256, U512};
    use odra::host::{Deployer, HostEnv, HostRef, NoArgs};
    use odra::prelude::{Address, Addressable};

    struct World {
        env: HostEnv,
        identity: IdentityRegistryHostRef,
        reputation: ReputationEngineHostRef,
        escrow: Address,
        admin: Address,
    }

    fn setup() -> World {
        let env = odra_test::env();
        let admin = env.get_account(8);
        let escrow = env.get_account(9);
        env.set_caller(admin);
        let identity = IdentityRegistry::deploy(&env, NoArgs);
        let mut reputation = ReputationEngine::deploy(&env, super::ReputationEngineInitArgs { identity: identity.address() });
        reputation.set_escrow(escrow);
        World { env, identity, reputation, escrow, admin }
    }

    /// Registers an agent owned by `owner` (with_tokens isolated for the ICE).
    fn register(identity: &mut IdentityRegistryHostRef, owner: Address, uri: &str) -> u32 {
        // caller set by the test
        let _ = owner;
        let mut bonded = identity.with_tokens(U512::from(MIN_BOND));
        bonded.register(uri.to_string())
    }

    fn record(w: &mut World, provider: u32, client_id: u32, amount: u64) {
        w.env.set_caller(w.escrow);
        w.reputation.record_settlement(provider, client_id, U256::from(amount));
    }

    #[test]
    fn unregistered_client_confers_no_reputation() {
        let mut w = setup();
        w.env.set_caller(w.env.get_account(0));
        let provider = register(&mut w.identity, w.env.get_account(0), "ipfs://p");

        // client_id 999 is not registered -> bond=0, inactive -> cp_weight 0
        record(&mut w, provider, 999, 1000);

        assert_eq!(w.reputation.score(provider), U256::zero());
        assert_eq!(w.reputation.get_reputation(provider).jobs_completed, 1); // counted, no score
    }

    #[test]
    fn slashed_client_confers_no_reputation() {
        let mut w = setup();
        // wire identity escrow so we can slash
        w.env.set_caller(w.admin);
        w.identity.set_escrow(w.escrow);
        let provider_owner = w.env.get_account(0);
        let client_owner = w.env.get_account(1);
        w.env.set_caller(provider_owner);
        let provider = register(&mut w.identity, provider_owner, "ipfs://p");
        w.env.set_caller(client_owner);
        let client = register(&mut w.identity, client_owner, "ipfs://c");
        // slash the client
        w.env.set_caller(w.escrow);
        w.identity.slash(client);

        record(&mut w, provider, client, 1000);

        assert_eq!(w.reputation.score(provider), U256::zero());
    }

    #[test]
    fn bonded_newcomer_client_bootstraps_via_floor() {
        let mut w = setup();
        let provider_owner = w.env.get_account(0);
        let client_owner = w.env.get_account(1);
        w.env.set_caller(provider_owner);
        let provider = register(&mut w.identity, provider_owner, "ipfs://p");
        w.env.set_caller(client_owner);
        let client = register(&mut w.identity, client_owner, "ipfs://c"); // bonded, earned=0

        record(&mut w, provider, client, 1000);

        // cold-start: bonded client's floor gives a small but positive score
        assert!(w.reputation.score(provider) > U256::zero());
    }

    #[test]
    fn repeated_pair_diminishes_and_is_edge_capped() {
        let mut w = setup();
        let provider_owner = w.env.get_account(0);
        let client_owner = w.env.get_account(1);
        w.env.set_caller(provider_owner);
        let provider = register(&mut w.identity, provider_owner, "ipfs://p");
        w.env.set_caller(client_owner);
        let client = register(&mut w.identity, client_owner, "ipfs://c");

        let mut deltas = Vec::new();
        let mut prev = U256::zero();
        for _ in 0..6 {
            record(&mut w, provider, client, 1000);
            let now = w.reputation.score(provider);
            deltas.push(now - prev);
            prev = now;
        }

        // each marginal contribution is non-increasing (diminishing returns)
        for i in 1..deltas.len() {
            assert!(deltas[i] <= deltas[i - 1]);
        }
        // pair lifetime contribution never exceeds the edge cap
        let pair = w.reputation.pair_stat(provider, client);
        assert!(pair.contributed_bps <= U256::from(super::EDGE_CAP_BASE_BPS) + U256::one());
        assert_eq!(pair.jobs, 6);
    }

    #[test]
    fn get_summary_has_8004_shape() {
        let mut w = setup();
        let provider_owner = w.env.get_account(0);
        let client_owner = w.env.get_account(1);
        w.env.set_caller(provider_owner);
        let provider = register(&mut w.identity, provider_owner, "ipfs://p");
        w.env.set_caller(client_owner);
        let client = register(&mut w.identity, client_owner, "ipfs://c");
        record(&mut w, provider, client, 1000);

        let (count, value, decimals) = w.reputation.get_summary(provider);
        assert_eq!(count, 1);
        assert_eq!(value, w.reputation.score(provider));
        assert_eq!(decimals, 4);
    }

    #[test]
    fn only_escrow_can_record() {
        let mut w = setup();
        w.env.set_caller(w.env.get_account(0));
        let result = w.reputation.try_record_settlement(1, 2, U256::from(1000u64));
        assert_eq!(result, Err(super::Error::NotEscrow.into()));
    }

    /// T3 — bought-edge / star laundering. An earning client cannot confer more
    /// reputation than its trust-conservation budget, no matter how many jobs it
    /// funds. This is the attack the naive 3-factor formula fails.
    #[test]
    fn trust_conservation_caps_an_earning_clients_grants() {
        let mut w = setup();
        w.env.set_caller(w.env.get_account(0));
        let f = register(&mut w.identity, w.env.get_account(0), "ipfs://f");
        w.env.set_caller(w.env.get_account(1));
        let target = register(&mut w.identity, w.env.get_account(1), "ipfs://t");
        w.env.set_caller(w.env.get_account(2));
        let s1 = register(&mut w.identity, w.env.get_account(2), "ipfs://s1");
        w.env.set_caller(w.env.get_account(3));
        let s2 = register(&mut w.identity, w.env.get_account(3), "ipfs://s2");
        w.env.set_caller(w.env.get_account(4));
        let s3 = register(&mut w.identity, w.env.get_account(4), "ipfs://s3");

        // Seed F's earned reputation from 3 distinct clients (large jobs).
        record(&mut w, f, s1, 1_000_000);
        record(&mut w, f, s2, 1_000_000);
        record(&mut w, f, s3, 1_000_000);
        let f_score = w.reputation.score(f);
        assert!(f_score > U256::zero());

        // F now tries to pump a target with many jobs — conservation caps the total.
        for _ in 0..10 {
            record(&mut w, target, f, 1_000_000);
        }

        let granted = w.reputation.get_reputation(f).granted_out_bps;
        let budget = f_score * U256::from(super::GRANT_K_BPS) / U256::from(super::BPS);
        assert!(granted > U256::zero()); // F has earned weight, so it does grant some
        assert!(granted <= budget); // ...but never more than its conservation budget
    }
}
