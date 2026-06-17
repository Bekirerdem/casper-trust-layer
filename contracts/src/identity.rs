use odra::casper_types::U512;
use odra::prelude::*;

/// Minimum bond (in motes) required to register an identity. 10 CSPR — our
/// cryptoeconomic addition on top of canonical ERC-8004 (which has no bond):
/// skin-in-the-game, slashed on misbehavior, refunded on withdrawal.
pub const MIN_BOND: u64 = 10_000_000_000;

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
}

/// ERC-8004-aligned registry of agent identities. `agent_id` is a sequential
/// `u32` (canonical). One account may own many identities; sybil resistance
/// lives in the economic layer (bond + escrow-derived reputation), not here.
#[odra::module(errors = Error, events = [Registered, AgentUriUpdated, AgentWalletSet, Transferred, AgentSlashed])]
pub struct IdentityRegistry {
    /// Admin that wires the escrow post-deploy.
    admin: Var<Address>,
    /// Escrow contract authorized to slash bonds on a settled dispute.
    escrow: Var<Address>,
    agents: Mapping<u32, Agent>,
    /// Total minted = next id to assign.
    count: Var<u32>,
}

#[odra::module]
impl IdentityRegistry {
    pub fn init(&mut self) {
        self.admin.set(self.env().caller());
    }

    /// Wires the escrow allowed to slash bonds (one-time, admin only) — set after
    /// the escrow is deployed, since the two contracts reference each other.
    pub fn set_escrow(&mut self, escrow: Address) {
        if self.env().caller() != self.admin.get().unwrap_or_revert(self) {
            self.env().revert(Error::NotAdmin);
        }
        if self.escrow.get().is_some() {
            self.env().revert(Error::EscrowAlreadySet);
        }
        self.escrow.set(escrow);
    }

    /// Registers a new identity owned by the caller (ERC-8004 `register_with_uri`
    /// plus our bond). Payable: the attached CSPR is the bond. Returns the new id.
    #[odra(payable)]
    pub fn register(&mut self, agent_uri: String) -> u32 {
        let bond = self.env().attached_value();
        if bond < U512::from(MIN_BOND) {
            self.env().revert(Error::InsufficientBond);
        }
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

    // ---- mutations (owner-gated) ---------------------------------------------

    /// Updates the agent card URI. Owner only.
    pub fn set_agent_uri(&mut self, agent_id: u32, new_uri: String) {
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

    /// Retires an identity (status -> Withdrawn) and refunds the bond. Owner only.
    pub fn withdraw(&mut self, agent_id: u32) {
        let mut agent = self.assert_owner(agent_id);
        let (owner, refund) = (agent.owner, agent.bond);
        agent.status = AgentStatus::Withdrawn;
        agent.bond = U512::zero();
        self.agents.set(&agent_id, agent);
        if !refund.is_zero() {
            self.env().transfer_tokens(&owner, &refund);
        }
    }

    /// Transfers the identity to `to`. Owner only. Resets the operational wallet
    /// (canonical ERC-8004 wipes wallet on transfer to prevent claim inheritance).
    pub fn transfer(&mut self, agent_id: u32, to: Address) {
        let mut agent = self.assert_owner(agent_id);
        let from = agent.owner;
        agent.owner = to;
        agent.wallet = to;
        self.agents.set(&agent_id, agent);
        self.env().emit_event(Transferred { agent_id, from, to });
    }

    /// Seizes an agent's bond and marks it `Slashed`. Only the authorized escrow,
    /// on a settled dispute where the agent failed to deliver. Slashing collapses
    /// the agent's reputation bond-floor and edge-cap (read live by the engine).
    pub fn slash(&mut self, agent_id: u32) {
        if self.env().caller() != self.escrow.get().unwrap_or_revert(self) {
            self.env().revert(Error::NotEscrow);
        }
        let mut agent = self.load(agent_id);
        agent.status = AgentStatus::Slashed;
        agent.bond = U512::zero();
        self.agents.set(&agent_id, agent);
        self.env().emit_event(AgentSlashed { agent_id });
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

/// Emitted when an identity is transferred to a new owner.
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

#[cfg(test)]
mod tests {
    use super::{
        Agent, AgentStatus, Error, IdentityRegistry, IdentityRegistryHostRef, Registered,
        Transferred, MIN_BOND,
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
        assert_eq!(registry.find_owner(42), None);
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
    fn transfer_moves_owner_and_resets_wallet() {
        let (env, mut registry) = deploy();
        let owner = env.get_account(0);
        let new_owner = env.get_account(1);
        let hot_wallet = env.get_account(2);
        env.set_caller(owner);
        let id = register(&mut registry, "ipfs://a");
        registry.set_agent_wallet(id, hot_wallet);

        registry.transfer(id, new_owner);

        assert_eq!(registry.find_owner(id), Some(new_owner));
        assert_eq!(registry.get_agent_wallet(id), new_owner);
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
    fn owner_can_withdraw() {
        let (env, mut registry) = deploy();
        env.set_caller(env.get_account(0));
        let id = register(&mut registry, "ipfs://a");

        registry.withdraw(id);

        assert_eq!(registry.get_agent(id).status, AgentStatus::Withdrawn);
        assert_eq!(registry.get_agent(id).bond, U512::zero());
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
    fn transfer_emits_transferred_event() {
        let (env, mut registry) = deploy();
        let owner = env.get_account(0);
        let new_owner = env.get_account(1);
        env.set_caller(owner);
        let id = register(&mut registry, "ipfs://a");

        registry.transfer(id, new_owner);

        assert!(env.emitted_event(
            &registry,
            Transferred { agent_id: id, from: owner, to: new_owner }
        ));
    }

    #[test]
    fn escrow_can_slash_and_seize_bond() {
        let (env, mut registry) = deploy(); // admin = account 0
        let escrow = env.get_account(9);
        let owner = env.get_account(1);
        env.set_caller(env.get_account(0));
        registry.set_escrow(escrow);
        env.set_caller(owner);
        let id = register(&mut registry, "ipfs://a");

        env.set_caller(escrow);
        registry.slash(id);

        let agent = registry.get_agent(id);
        assert_eq!(agent.status, AgentStatus::Slashed);
        assert_eq!(agent.bond, U512::zero());
    }

    #[test]
    fn non_escrow_cannot_slash() {
        let (env, mut registry) = deploy();
        let escrow = env.get_account(9);
        env.set_caller(env.get_account(0));
        registry.set_escrow(escrow);
        env.set_caller(env.get_account(1));
        let id = register(&mut registry, "ipfs://a");

        env.set_caller(env.get_account(2));
        let result = registry.try_slash(id);

        assert_eq!(result, Err(Error::NotEscrow.into()));
    }
}
