use odra::casper_types::U512;
use odra::prelude::*;

/// Minimum bond (in motes) required to register an identity. 10 CSPR — our
/// cryptoeconomic addition on top of canonical ERC-8004 (which has no bond):
/// skin-in-the-game, slashed on misbehavior, refunded on withdrawal.
pub const MIN_BOND: u64 = 10_000_000_000;

/// Share of the current bond seized per escrow default (basis points). The bond
/// is native CSPR while jobs settle in a CEP-18 token, so "proportional to the
/// job amount" has no common unit; a fixed share of the bond is the honest
/// version. The seized share goes to the wronged client, it is never stuck.
pub const SLASH_BPS: u64 = 2_000; // 20%

/// How long a bond stays locked after the owner asks to withdraw (Unix ms).
/// Stops "register, misbehave, pull the bond, re-register" recycling.
pub const UNBONDING_DELAY_MS: u64 = 7 * 86_400_000;

/// Delay before a proposed escrow address replaces the current one (Unix ms).
pub const ESCROW_TIMELOCK_MS: u64 = 2 * 86_400_000;

/// Upper bound on the agent card URI, so registrations cannot bloat state.
pub const MAX_URI_LEN: usize = 512;

/// Lifecycle status of an agent identity.
#[odra::odra_type]
pub enum AgentStatus {
    /// Registered and usable.
    Active,
    /// Bond slashed for misbehavior (set by escrow/reputation).
    Slashed,
    /// Voluntarily retired by its owner.
    Withdrawn,
}

/// An on-chain agent identity. Mirrors the ERC-8004 Identity Registry surface
/// (owner, agent_uri, agent_wallet) plus our bond/status.
#[odra::odra_type]
pub struct Agent {
    /// Account that controls the identity (the transferable "NFT owner").
    pub owner: Address,
    /// Operational wallet the agent transacts from (ERC-8004 `agentWallet`).
    /// Defaults to the owner on registration; reset on transfer.
    pub wallet: Address,
    /// URI of the agent card (ERC-8004 registration metadata: name, services,
    /// supportedTrust, x402). Off-chain JSON.
    pub agent_uri: String,
    /// Bonded collateral (motes) backing this identity.
    pub bond: U512,
    /// Lifecycle status.
    pub status: AgentStatus,
}

/// Error variants for the identity registry.
#[odra::odra_error]
pub enum Error {
    /// No identity exists for the requested id.
    AgentNotFound = 1,
    /// Caller is not the owner of the identity.
    NotOwner = 2,
    /// Attached bond is below the required minimum.
    InsufficientBond = 3,
    /// Caller is not the admin.
    NotAdmin = 4,
    /// Caller is not the authorized escrow.
    NotEscrow = 5,
    /// The escrow address has already been wired.
    EscrowAlreadySet = 6,
    /// The agent card URI is longer than `MAX_URI_LEN`.
    UriTooLong = 7,
    /// The bond is locked while the agent has open escrow jobs.
    OpenJobs = 8,
    /// `withdraw` needs a prior `request_withdraw`.
    WithdrawNotRequested = 9,
    /// The unbonding delay has not elapsed yet.
    StillUnbonding = 10,
    /// The identity is not in a state that allows this call.
    InvalidStatus = 11,
    /// Caller is not the pending owner / pending admin.
    NotPending = 12,
    /// No escrow change is pending.
    NoPendingEscrow = 13,
    /// The escrow change timelock has not elapsed yet.
    TimelockActive = 14,
}

/// ERC-8004-aligned registry of agent identities. `agent_id` is a sequential
/// `u32` (canonical). One account may own many identities; sybil resistance
/// lives in the economic layer (bond + escrow-derived reputation), not here.
#[allow(dead_code)]
#[odra::module(
    errors = Error,
    events = [
        Registered, AgentUriUpdated, AgentWalletSet, Transferred, AgentSlashed,
        TransferProposed, WithdrawRequested, WithdrawCancelled, BondSeized,
        AdminTransferStarted, AdminChanged, EscrowProposed, EscrowChanged
    ]
)]
pub struct IdentityRegistry {
    /// Admin that wires the escrow post-deploy.
    admin: Var<Address>,
    /// Escrow contract authorized to slash bonds on a settled dispute.
    escrow: Var<Address>,
    agents: Mapping<u32, Agent>,
    /// Total minted = next id to assign.
    count: Var<u32>,
    // ---- v2 — appended so earlier storage indices stay valid off-chain ----
    /// Escrow jobs the agent has accepted and not yet closed. Bond is locked while > 0.
    open_jobs: Mapping<u32, u32>,
    /// When a requested withdrawal becomes executable (Unix ms). 0 = not unbonding.
    unbond_ready_at: Mapping<u32, u64>,
    /// Proposed new owner of an identity (two-step transfer).
    pending_owner: Mapping<u32, Option<Address>>,
    /// Bumped on every completed transfer, so allow-lists keyed by agent id can
    /// tell that the identity changed hands.
    transfer_count: Mapping<u32, u32>,
    pending_admin: Var<Option<Address>>,
    pending_escrow: Var<Address>,
    pending_escrow_at: Var<u64>,
}

#[odra::module]
impl IdentityRegistry {
    pub fn init(&mut self) {
        self.admin.set(self.env().caller());
    }

    /// Wires the escrow allowed to slash bonds (one-time, admin only) — set after
    /// the escrow is deployed, since the two contracts reference each other.
    /// Later changes go through the timelocked `propose_escrow` / `apply_escrow`.
    pub fn set_escrow(&mut self, escrow: Address) {
        self.only_admin();
        if self.escrow.get().is_some() {
            self.env().revert(Error::EscrowAlreadySet);
        }
        self.escrow.set(escrow);
        self.env().emit_event(EscrowChanged { escrow });
    }

    /// Registers a new identity owned by the caller (ERC-8004 `register_with_uri`
    /// plus our bond). Payable: the attached CSPR is the bond. Returns the new id.
    #[odra(payable)]
    pub fn register(&mut self, agent_uri: String) -> u32 {
        let bond = self.env().attached_value();
        if bond < U512::from(MIN_BOND) {
            self.env().revert(Error::InsufficientBond);
        }
        self.check_uri(&agent_uri);
        let caller = self.env().caller();
        let id = self.count.get_or_default();
        self.agents.set(
            &id,
            Agent {
                owner: caller,
                wallet: caller,
                agent_uri,
                bond,
                status: AgentStatus::Active,
            },
        );
        self.count.set(id + 1);
        self.env().emit_event(Registered { agent_id: id, owner: caller });
        id
    }

    // ---- ERC-8004 read surface ------------------------------------------------

    /// Whether an identity exists for `agent_id`.
    pub fn agent_exists(&self, agent_id: u32) -> bool {
        self.agents.get(&agent_id).is_some()
    }

    /// Whether the identity exists, is `Active` and is not unbonding — the one
    /// check every payment gate and the escrow use. Non-reverting.
    pub fn is_active(&self, agent_id: u32) -> bool {
        match self.agents.get(&agent_id) {
            Some(a) => {
                matches!(a.status, AgentStatus::Active) && self.unbond_ready_at.get_or_default(&agent_id) == 0
            }
            None => false,
        }
    }

    /// Status of an identity, or `None` if it does not exist. Non-reverting.
    pub fn status_of(&self, agent_id: u32) -> Option<AgentStatus> {
        self.agents.get(&agent_id).map(|a| a.status)
    }

    /// Number of identities ever registered (= next id).
    pub fn total_agents(&self) -> u32 {
        self.count.get_or_default()
    }

    /// Owner of an identity, or `None` if it does not exist (non-reverting —
    /// safe for cross-contract trust checks).
    pub fn find_owner(&self, agent_id: u32) -> Option<Address> {
        self.agents.get(&agent_id).map(|a| a.owner)
    }

    /// The agent card URI. Reverts if the identity does not exist.
    pub fn agent_uri(&self, agent_id: u32) -> String {
        self.load(agent_id).agent_uri
    }

    /// The agent's operational wallet. Reverts if it does not exist.
    pub fn get_agent_wallet(&self, agent_id: u32) -> Address {
        self.load(agent_id).wallet
    }

    /// Full identity record. Reverts if it does not exist.
    pub fn get_agent(&self, agent_id: u32) -> Agent {
        self.load(agent_id)
    }

    /// Whether `who` may act for the identity (v1: owner only; approvals later).
    pub fn is_authorized_or_owner(&self, who: Address, agent_id: u32) -> bool {
        self.agents
            .get(&agent_id)
            .map(|a| a.owner == who)
            .unwrap_or(false)
    }

    pub fn open_jobs(&self, agent_id: u32) -> u32 {
        self.open_jobs.get(&agent_id).unwrap_or_default()
    }

    /// When a requested withdrawal unlocks (Unix ms), or `None` if not unbonding.
    pub fn unbond_ready_at(&self, agent_id: u32) -> Option<u64> {
        match self.unbond_ready_at.get_or_default(&agent_id) {
            0 => None,
            t => Some(t),
        }
    }

    pub fn pending_owner(&self, agent_id: u32) -> Option<Address> {
        self.pending_owner.get(&agent_id).flatten()
    }

    /// Number of completed transfers of this identity.
    pub fn transfer_count(&self, agent_id: u32) -> u32 {
        self.transfer_count.get(&agent_id).unwrap_or_default()
    }

    pub fn admin(&self) -> Address {
        self.admin.get().unwrap_or_revert(self)
    }

    pub fn escrow(&self) -> Option<Address> {
        self.escrow.get()
    }

    // ---- mutations (owner-gated) ---------------------------------------------

    /// Updates the agent card URI. Owner only.
    pub fn set_agent_uri(&mut self, agent_id: u32, new_uri: String) {
        self.check_uri(&new_uri);
        let mut agent = self.assert_owner(agent_id);
        agent.agent_uri = new_uri;
        self.agents.set(&agent_id, agent);
        self.env().emit_event(AgentUriUpdated { agent_id });
    }

    /// Sets the operational wallet. Owner only.
    pub fn set_agent_wallet(&mut self, agent_id: u32, wallet: Address) {
        let mut agent = self.assert_owner(agent_id);
        agent.wallet = wallet;
        self.agents.set(&agent_id, agent);
        self.env().emit_event(AgentWalletSet { agent_id, wallet });
    }

    /// Starts retiring an identity: the agent stops being `is_active` at once and
    /// the bond unlocks after `UNBONDING_DELAY_MS`. Not allowed with open jobs.
    /// Owner only. A slashed identity may also reclaim what is left of its bond.
    pub fn request_withdraw(&mut self, agent_id: u32) {
        let agent = self.assert_owner(agent_id);
        if matches!(agent.status, AgentStatus::Withdrawn) {
            self.env().revert(Error::InvalidStatus);
        }
        if self.open_jobs(agent_id) > 0 {
            self.env().revert(Error::OpenJobs);
        }
        let ready_at = self.env().get_block_time() + UNBONDING_DELAY_MS;
        self.unbond_ready_at.set(&agent_id, ready_at);
        self.env().emit_event(WithdrawRequested { agent_id, ready_at });
    }

    /// Changes the owner's mind: the identity becomes active again. Owner only.
    pub fn cancel_withdraw(&mut self, agent_id: u32) {
        self.assert_owner(agent_id);
        if self.unbond_ready_at(agent_id).is_none() {
            self.env().revert(Error::WithdrawNotRequested);
        }
        self.unbond_ready_at.set(&agent_id, 0);
        self.env().emit_event(WithdrawCancelled { agent_id });
    }

    /// Retires an identity (status -> Withdrawn, unless it was slashed) and
    /// refunds the bond, once the unbonding delay has passed. Owner only.
    pub fn withdraw(&mut self, agent_id: u32) {
        let mut agent = self.assert_owner(agent_id);
        let ready_at = self
            .unbond_ready_at(agent_id)
            .unwrap_or_revert_with(self, Error::WithdrawNotRequested);
        if self.env().get_block_time() < ready_at {
            self.env().revert(Error::StillUnbonding);
        }
        // Belt and braces: an unbonding agent cannot accept jobs, so this holds.
        if self.open_jobs(agent_id) > 0 {
            self.env().revert(Error::OpenJobs);
        }
        let (owner, refund) = (agent.owner, agent.bond);
        if matches!(agent.status, AgentStatus::Active) {
            agent.status = AgentStatus::Withdrawn;
        }
        agent.bond = U512::zero();
        self.agents.set(&agent_id, agent);
        if !refund.is_zero() {
            self.env().transfer_tokens(&owner, &refund);
        }
    }

    /// Proposes moving the identity to `to` (step one of two). The current owner
    /// stays in control until `to` calls `accept_transfer`. Owner only; calling
    /// it again replaces the proposal.
    pub fn transfer(&mut self, agent_id: u32, to: Address) {
        self.assert_owner(agent_id);
        self.pending_owner.set(&agent_id, Some(to));
        self.env().emit_event(TransferProposed { agent_id, to });
    }

    /// The proposed owner takes the identity. Resets the operational wallet
    /// (canonical ERC-8004 wipes wallet on transfer to prevent claim inheritance)
    /// and bumps `transfer_count`, which invalidates allow-list entries.
    pub fn accept_transfer(&mut self, agent_id: u32) {
        let caller = self.env().caller();
        match self.pending_owner(agent_id) {
            Some(p) if p == caller => {}
            _ => self.env().revert(Error::NotPending),
        }
        let mut agent = self.load(agent_id);
        let from = agent.owner;
        agent.owner = caller;
        agent.wallet = caller;
        self.agents.set(&agent_id, agent);
        self.pending_owner.set(&agent_id, None);
        self.transfer_count.set(&agent_id, self.transfer_count(agent_id) + 1);
        self.env().emit_event(Transferred { agent_id, from, to: caller });
    }

    // ---- escrow hooks -----------------------------------------------------------

    /// The escrow marks a job the agent accepted. Locks the bond until closed.
    pub fn job_opened(&mut self, agent_id: u32) {
        self.only_escrow();
        self.open_jobs.set(&agent_id, self.open_jobs(agent_id) + 1);
    }

    /// The escrow marks an accepted job as finished (any outcome).
    pub fn job_closed(&mut self, agent_id: u32) {
        self.only_escrow();
        let open = self.open_jobs(agent_id);
        self.open_jobs.set(&agent_id, open.saturating_sub(1));
    }

    /// Seizes `SLASH_BPS` of an agent's bond, sends it to `to` (the wronged
    /// client) and marks the agent `Slashed`. Only the authorized escrow, on a
    /// deadline default. Returns the seized motes. Slashing collapses the agent's
    /// reputation (score reads 0) and its bond-floor as a client.
    pub fn slash(&mut self, agent_id: u32, to: Address) -> U512 {
        self.only_escrow();
        let mut agent = self.load(agent_id);
        let seized = agent.bond * U512::from(SLASH_BPS) / U512::from(10_000u64);
        agent.status = AgentStatus::Slashed;
        agent.bond -= seized;
        self.agents.set(&agent_id, agent);
        if !seized.is_zero() {
            self.env().transfer_tokens(&to, &seized);
        }
        self.env().emit_event(AgentSlashed { agent_id });
        self.env().emit_event(BondSeized { agent_id, amount: seized, to });
        seized
    }

    // ---- admin -------------------------------------------------------------------

    /// Starts a two-step admin handover; `to` must call `accept_admin`.
    pub fn transfer_admin(&mut self, to: Address) {
        self.only_admin();
        self.pending_admin.set(Some(to));
        self.env().emit_event(AdminTransferStarted { to });
    }

    pub fn accept_admin(&mut self) {
        let caller = self.env().caller();
        if self.pending_admin.get().flatten() != Some(caller) {
            self.env().revert(Error::NotPending);
        }
        self.admin.set(caller);
        self.pending_admin.set(None);
        self.env().emit_event(AdminChanged { admin: caller });
    }

    /// Proposes a replacement escrow; it takes effect after `ESCROW_TIMELOCK_MS`
    /// so agents can see it coming. Admin only.
    pub fn propose_escrow(&mut self, escrow: Address) {
        self.only_admin();
        let at = self.env().get_block_time() + ESCROW_TIMELOCK_MS;
        self.pending_escrow.set(escrow);
        self.pending_escrow_at.set(at);
        self.env().emit_event(EscrowProposed { escrow, effective_at: at });
    }

    pub fn apply_escrow(&mut self) {
        self.only_admin();
        let escrow = self
            .pending_escrow
            .get()
            .unwrap_or_revert_with(self, Error::NoPendingEscrow);
        if self.env().get_block_time() < self.pending_escrow_at.get_or_default() {
            self.env().revert(Error::TimelockActive);
        }
        self.escrow.set(escrow);
        self.pending_escrow_at.set(u64::MAX);
        self.env().emit_event(EscrowChanged { escrow });
    }

    // ---- internal -------------------------------------------------------------

    fn load(&self, agent_id: u32) -> Agent {
        self.agents
            .get(&agent_id)
            .unwrap_or_revert_with(self, Error::AgentNotFound)
    }

    fn assert_owner(&self, agent_id: u32) -> Agent {
        let agent = self.load(agent_id);
        if agent.owner != self.env().caller() {
            self.env().revert(Error::NotOwner);
        }
        agent
    }

    fn only_admin(&self) {
        if self.env().caller() != self.admin.get().unwrap_or_revert(self) {
            self.env().revert(Error::NotAdmin);
        }
    }

    fn only_escrow(&self) {
        if self.env().caller() != self.escrow.get().unwrap_or_revert(self) {
            self.env().revert(Error::NotEscrow);
        }
    }

    fn check_uri(&self, uri: &str) {
        if uri.len() > MAX_URI_LEN {
            self.env().revert(Error::UriTooLong);
        }
    }
}

/// Emitted when a new identity is registered (ERC-8004 `Registered`).
#[odra::event]
pub struct Registered {
    pub agent_id: u32,
    pub owner: Address,
}

/// Emitted when an agent's card URI is updated.
#[odra::event]
pub struct AgentUriUpdated {
    pub agent_id: u32,
}

/// Emitted when an agent's operational wallet is set.
#[odra::event]
pub struct AgentWalletSet {
    pub agent_id: u32,
    pub wallet: Address,
}

/// Emitted when an identity transfer completes (the new owner accepted).
#[odra::event]
pub struct Transferred {
    pub agent_id: u32,
    pub from: Address,
    pub to: Address,
}

/// Emitted when an agent's bond is slashed.
#[odra::event]
pub struct AgentSlashed {
    pub agent_id: u32,
}

/// Emitted when an owner proposes a transfer.
#[odra::event]
pub struct TransferProposed {
    pub agent_id: u32,
    pub to: Address,
}

/// Emitted when an owner starts unbonding.
#[odra::event]
pub struct WithdrawRequested {
    pub agent_id: u32,
    pub ready_at: u64,
}

/// Emitted when an owner cancels unbonding.
#[odra::event]
pub struct WithdrawCancelled {
    pub agent_id: u32,
}

/// Emitted with the slashed amount and where it went.
#[odra::event]
pub struct BondSeized {
    pub agent_id: u32,
    pub amount: U512,
    pub to: Address,
}

#[odra::event]
pub struct AdminTransferStarted {
    pub to: Address,
}

#[odra::event]
pub struct AdminChanged {
    pub admin: Address,
}

#[odra::event]
pub struct EscrowProposed {
    pub escrow: Address,
    pub effective_at: u64,
}

#[odra::event]
pub struct EscrowChanged {
    pub escrow: Address,
}

#[cfg(test)]
mod tests {
    use super::{
        Agent, AgentStatus, Error, IdentityRegistry, IdentityRegistryHostRef, Registered,
        Transferred, ESCROW_TIMELOCK_MS, MAX_URI_LEN, MIN_BOND, SLASH_BPS, UNBONDING_DELAY_MS,
    };
    use odra::casper_types::U512;
    use odra::host::{Deployer, HostRef, NoArgs};

    // `with_tokens` is isolated in helpers on purpose: keeping the handle out of a
    // test body that also re-borrows the registry sidesteps a rustc borrowck ICE on
    // this pinned nightly (see tasks/lessons.md).
    fn register_with(reg: &mut IdentityRegistryHostRef, tokens: U512, uri: &str) -> u32 {
        let mut bonded = reg.with_tokens(tokens);
        bonded.register(uri.to_string())
    }

    fn try_register_with(
        reg: &mut IdentityRegistryHostRef,
        tokens: U512,
        uri: &str,
    ) -> odra::prelude::OdraResult<u32> {
        let mut bonded = reg.with_tokens(tokens);
        bonded.try_register(uri.to_string())
    }

    fn register(reg: &mut IdentityRegistryHostRef, uri: &str) -> u32 {
        register_with(reg, U512::from(MIN_BOND), uri)
    }

    fn deploy() -> (odra::host::HostEnv, IdentityRegistryHostRef) {
        let env = odra_test::env();
        env.set_caller(env.get_account(0)); // account 0 is the admin
        let registry = IdentityRegistry::deploy(&env, NoArgs);
        (env, registry)
    }

    #[test]
    fn register_records_owner_wallet_uri_bond_status() {
        let (env, mut registry) = deploy();
        let agent = env.get_account(0);
        env.set_caller(agent);

        let id = register(&mut registry, "ipfs://agent-card");

        let record: Agent = registry.get_agent(id);
        assert_eq!(record.owner, agent);
        assert_eq!(record.wallet, agent);
        assert_eq!(record.agent_uri, "ipfs://agent-card".to_string());
        assert_eq!(record.bond, U512::from(MIN_BOND));
        assert_eq!(record.status, AgentStatus::Active);
        assert!(registry.agent_exists(id));
        assert!(registry.is_active(id));
        assert_eq!(registry.find_owner(id), Some(agent));
        assert_eq!(registry.agent_uri(id), "ipfs://agent-card".to_string());
    }

    #[test]
    fn ids_are_sequential_u32_and_counted() {
        let (env, mut registry) = deploy();
        env.set_caller(env.get_account(0));

        let first = register(&mut registry, "ipfs://a");
        let second = register(&mut registry, "ipfs://b");

        assert_eq!(first, 0);
        assert_eq!(second, 1);
        assert_eq!(registry.total_agents(), 2);
    }

    #[test]
    fn unknown_agent_reads_are_safe() {
        let (_env, registry) = deploy();
        assert!(!registry.agent_exists(42));
        assert!(!registry.is_active(42));
        assert_eq!(registry.find_owner(42), None);
        assert_eq!(registry.status_of(42), None);
        assert_eq!(registry.total_agents(), 0);
    }

    #[test]
    fn register_rejects_insufficient_bond() {
        let (env, mut registry) = deploy();
        env.set_caller(env.get_account(0));

        let result = try_register_with(&mut registry, U512::from(MIN_BOND - 1), "ipfs://a");

        assert_eq!(result, Err(Error::InsufficientBond.into()));
    }

    #[test]
    fn register_rejects_oversized_uri() {
        let (env, mut registry) = deploy();
        env.set_caller(env.get_account(0));
        let huge = "x".repeat(MAX_URI_LEN + 1);

        let result = try_register_with(&mut registry, U512::from(MIN_BOND), &huge);

        assert_eq!(result, Err(Error::UriTooLong.into()));
    }

    #[test]
    fn owner_can_set_agent_uri() {
        let (env, mut registry) = deploy();
        env.set_caller(env.get_account(0));
        let id = register(&mut registry, "ipfs://old");

        registry.set_agent_uri(id, "ipfs://new".to_string());

        assert_eq!(registry.agent_uri(id), "ipfs://new".to_string());
    }

    #[test]
    fn non_owner_cannot_set_agent_uri() {
        let (env, mut registry) = deploy();
        env.set_caller(env.get_account(0));
        let id = register(&mut registry, "ipfs://old");

        env.set_caller(env.get_account(1));
        let result = registry.try_set_agent_uri(id, "ipfs://hacked".to_string());

        assert_eq!(result, Err(Error::NotOwner.into()));
        assert_eq!(registry.agent_uri(id), "ipfs://old".to_string());
    }

    #[test]
    fn owner_can_set_agent_wallet() {
        let (env, mut registry) = deploy();
        let owner = env.get_account(0);
        let hot_wallet = env.get_account(1);
        env.set_caller(owner);
        let id = register(&mut registry, "ipfs://a");

        registry.set_agent_wallet(id, hot_wallet);

        assert_eq!(registry.get_agent_wallet(id), hot_wallet);
        assert_eq!(registry.find_owner(id), Some(owner));
    }

    #[test]
    fn transfer_is_two_step_and_resets_wallet() {
        let (env, mut registry) = deploy();
        let owner = env.get_account(0);
        let new_owner = env.get_account(1);
        let hot_wallet = env.get_account(2);
        env.set_caller(owner);
        let id = register(&mut registry, "ipfs://a");
        registry.set_agent_wallet(id, hot_wallet);

        registry.transfer(id, new_owner);
        // Nothing moves until the recipient accepts.
        assert_eq!(registry.find_owner(id), Some(owner));
        assert_eq!(registry.pending_owner(id), Some(new_owner));

        env.set_caller(new_owner);
        registry.accept_transfer(id);

        assert_eq!(registry.find_owner(id), Some(new_owner));
        assert_eq!(registry.get_agent_wallet(id), new_owner);
        assert_eq!(registry.transfer_count(id), 1);
        assert_eq!(registry.pending_owner(id), None);
    }

    #[test]
    fn only_the_proposed_owner_can_accept() {
        let (env, mut registry) = deploy();
        env.set_caller(env.get_account(0));
        let id = register(&mut registry, "ipfs://a");
        registry.transfer(id, env.get_account(1));

        env.set_caller(env.get_account(2));
        assert_eq!(registry.try_accept_transfer(id), Err(Error::NotPending.into()));
        assert_eq!(registry.find_owner(id), Some(env.get_account(0)));
    }

    #[test]
    fn non_owner_cannot_transfer() {
        let (env, mut registry) = deploy();
        env.set_caller(env.get_account(0));
        let id = register(&mut registry, "ipfs://a");

        env.set_caller(env.get_account(1));
        let result = registry.try_transfer(id, env.get_account(1));

        assert_eq!(result, Err(Error::NotOwner.into()));
        assert_eq!(registry.find_owner(id), Some(env.get_account(0)));
    }

    #[test]
    fn withdraw_needs_request_and_unbonding_delay() {
        let (env, mut registry) = deploy();
        env.set_caller(env.get_account(0));
        let id = register(&mut registry, "ipfs://a");

        // No instant exit.
        assert_eq!(registry.try_withdraw(id), Err(Error::WithdrawNotRequested.into()));

        registry.request_withdraw(id);
        assert!(!registry.is_active(id)); // stops working immediately
        assert_eq!(registry.try_withdraw(id), Err(Error::StillUnbonding.into()));

        env.advance_block_time(UNBONDING_DELAY_MS);
        registry.withdraw(id);

        assert_eq!(registry.get_agent(id).status, AgentStatus::Withdrawn);
        assert_eq!(registry.get_agent(id).bond, U512::zero());
    }

    #[test]
    fn cancel_withdraw_reactivates() {
        let (env, mut registry) = deploy();
        env.set_caller(env.get_account(0));
        let id = register(&mut registry, "ipfs://a");
        registry.request_withdraw(id);
        registry.cancel_withdraw(id);
        assert!(registry.is_active(id));
    }

    #[test]
    fn bond_is_locked_while_jobs_are_open() {
        let (env, mut registry) = deploy();
        let escrow = env.get_account(9);
        env.set_caller(env.get_account(0));
        registry.set_escrow(escrow);
        let id = register(&mut registry, "ipfs://a");

        env.set_caller(escrow);
        registry.job_opened(id);

        env.set_caller(env.get_account(0));
        assert_eq!(registry.try_request_withdraw(id), Err(Error::OpenJobs.into()));

        env.set_caller(escrow);
        registry.job_closed(id);
        env.set_caller(env.get_account(0));
        assert!(registry.try_request_withdraw(id).is_ok());
    }

    #[test]
    fn is_authorized_or_owner_tracks_ownership() {
        let (env, mut registry) = deploy();
        let owner = env.get_account(0);
        let other = env.get_account(1);
        env.set_caller(owner);
        let id = register(&mut registry, "ipfs://a");

        assert!(registry.is_authorized_or_owner(owner, id));
        assert!(!registry.is_authorized_or_owner(other, id));
    }

    #[test]
    fn register_emits_registered_event() {
        let (env, mut registry) = deploy();
        let agent = env.get_account(0);
        env.set_caller(agent);

        let id = register(&mut registry, "ipfs://a");

        assert!(env.emitted_event(&registry, Registered { agent_id: id, owner: agent }));
    }

    #[test]
    fn accept_transfer_emits_transferred_event() {
        let (env, mut registry) = deploy();
        let owner = env.get_account(0);
        let new_owner = env.get_account(1);
        env.set_caller(owner);
        let id = register(&mut registry, "ipfs://a");

        registry.transfer(id, new_owner);
        env.set_caller(new_owner);
        registry.accept_transfer(id);

        assert!(env.emitted_event(
            &registry,
            Transferred { agent_id: id, from: owner, to: new_owner }
        ));
    }

    #[test]
    fn escrow_slash_seizes_a_share_and_pays_the_client() {
        let (env, mut registry) = deploy(); // admin = account 0
        let escrow = env.get_account(9);
        let owner = env.get_account(1);
        let client = env.get_account(5);
        env.set_caller(env.get_account(0));
        registry.set_escrow(escrow);
        env.set_caller(owner);
        let id = register(&mut registry, "ipfs://a");
        let client_before = env.balance_of(&client);

        env.set_caller(escrow);
        let seized = registry.slash(id, client);

        let expected = U512::from(MIN_BOND) * U512::from(SLASH_BPS) / U512::from(10_000u64);
        assert_eq!(seized, expected);
        let agent = registry.get_agent(id);
        assert_eq!(agent.status, AgentStatus::Slashed);
        assert_eq!(agent.bond, U512::from(MIN_BOND) - expected);
        assert_eq!(env.balance_of(&client), client_before + expected); // not stuck
        assert!(!registry.is_active(id));
    }

    #[test]
    fn slashed_agent_can_reclaim_the_rest_after_unbonding() {
        let (env, mut registry) = deploy();
        let escrow = env.get_account(9);
        env.set_caller(env.get_account(0));
        registry.set_escrow(escrow);
        env.set_caller(env.get_account(1));
        let id = register(&mut registry, "ipfs://a");
        env.set_caller(escrow);
        registry.slash(id, env.get_account(5));

        env.set_caller(env.get_account(1));
        registry.request_withdraw(id);
        env.advance_block_time(UNBONDING_DELAY_MS);
        registry.withdraw(id);

        let agent = registry.get_agent(id);
        assert_eq!(agent.status, AgentStatus::Slashed); // the record stays
        assert_eq!(agent.bond, U512::zero());
    }

    #[test]
    fn non_escrow_cannot_slash_or_touch_job_counters() {
        let (env, mut registry) = deploy();
        let escrow = env.get_account(9);
        env.set_caller(env.get_account(0));
        registry.set_escrow(escrow);
        env.set_caller(env.get_account(1));
        let id = register(&mut registry, "ipfs://a");

        env.set_caller(env.get_account(2));
        assert_eq!(registry.try_slash(id, env.get_account(2)), Err(Error::NotEscrow.into()));
        assert_eq!(registry.try_job_opened(id), Err(Error::NotEscrow.into()));
        assert_eq!(registry.try_job_closed(id), Err(Error::NotEscrow.into()));
    }

    #[test]
    fn admin_handover_is_two_step() {
        let (env, mut registry) = deploy();
        let next = env.get_account(3);
        registry.transfer_admin(next);
        assert_eq!(registry.admin(), env.get_account(0));

        env.set_caller(env.get_account(4));
        assert_eq!(registry.try_accept_admin(), Err(Error::NotPending.into()));

        env.set_caller(next);
        registry.accept_admin();
        assert_eq!(registry.admin(), next);
    }

    #[test]
    fn escrow_can_be_replaced_only_after_the_timelock() {
        let (env, mut registry) = deploy();
        registry.set_escrow(env.get_account(9));
        assert_eq!(
            registry.try_set_escrow(env.get_account(8)),
            Err(Error::EscrowAlreadySet.into())
        );

        registry.propose_escrow(env.get_account(8));
        assert_eq!(registry.try_apply_escrow(), Err(Error::TimelockActive.into()));
        env.advance_block_time(ESCROW_TIMELOCK_MS);
        registry.apply_escrow();
        assert_eq!(registry.escrow(), Some(env.get_account(8)));
    }
}
