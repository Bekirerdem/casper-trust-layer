// Deferred cross-contract refs — first used in Tasks 3-5; present per brief's use-block.
use crate::identity::IdentityRegistryContractRef;
#[allow(unused_imports)]
use crate::reputation::ReputationEngineContractRef;
use odra::casper_types::U256;
use odra::prelude::*;
use odra::ContractRef;
use odra_modules::cep18_token::Cep18ContractRef;

/// Casper `get_block_time()` returns Unix MILLISECONDS, so a UTC day bucket
/// divides by this (NOT 86_400). Reservation deadlines are milliseconds too.
#[allow(dead_code)]
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
#[allow(dead_code)]
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
        let addr = self.env().self_address();
        self.token_ref().balance_of(&addr)
    }

    pub fn day_spent(&self) -> U256 {
        self.day_spent.get(&self.today()).unwrap_or_default()
    }

    pub fn task_spent(&self, task_id: u64) -> U256 {
        self.task_spent.get(&task_id).unwrap_or_default()
    }

    // ---- private helpers -------------------------------------------------------

    fn only_admin(&self) {
        if self.env().caller() != self.admin.get().unwrap_or_revert(self) {
            self.env().revert(Error::NotAdmin);
        }
    }

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

#[cfg(test)]
mod tests {
    use super::{AgentTreasury, AgentTreasuryHostRef, AgentTreasuryInitArgs};
    use crate::identity::{IdentityRegistry, IdentityRegistryHostRef, MIN_BOND};
    use odra::casper_types::{U256, U512};
    use odra::host::{Deployer, HostEnv, HostRef, NoArgs};
    use odra::prelude::{Address, Addressable};
    use odra_modules::cep18_token::{Cep18, Cep18HostRef, Cep18InitArgs};

    const SUPPLY: u64 = 1_000_000_000;
    const DAILY: u64 = 100_000;
    const PER_TASK: u64 = 40_000;

    #[allow(dead_code)]
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
}
