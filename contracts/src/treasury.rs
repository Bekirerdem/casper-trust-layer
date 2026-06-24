// Deferred cross-contract refs — first used in Tasks 3-5; present per brief's use-block.
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
        let task_spent = self.task_spent.get(&task_id).unwrap_or_default();
        if task_spent + amount > self.per_task_limit.get_or_default() {
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
        self.day_spent.set(&day, spent_today + amount);
        self.task_spent.set(&task_id, task_spent + amount);

        let wallet = self.agent_wallet(payee);
        self.token_ref().transfer(&wallet, &amount);
        self.env().emit_event(Paid { task_id, payee, amount });
    }

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

    // ---- reservation lifecycle -------------------------------------------------

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
        let task_spent = self.task_spent.get(&r.task_id).unwrap_or_default();
        if task_spent + r.amount > self.per_task_limit.get_or_default() {
            self.env().revert(Error::ExceedsTaskLimit);
        }

        // EFFECTS before INTERACTION.
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

    fn load_reservation(&self, id: u64) -> Reservation {
        self.reservations
            .get(&id)
            .unwrap_or_revert_with(self, Error::ReservationNotFound)
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
    fn pay_rejects_cumulative_over_per_task_limit() {
        let mut w = setup();
        let provider_wallet = w.env.get_account(2);
        w.env.set_caller(provider_wallet);
        let provider = register(&mut w.identity, "ipfs://provider");
        w.env.set_caller(w.admin);
        w.treasury.add_payee(provider);
        fund_treasury(&mut w, 200_000);

        w.env.set_caller(w.agent);
        w.treasury.pay(1, provider, U256::from(40_000u64)); // == PER_TASK, ok
        let result = w.treasury.try_pay(1, provider, U256::from(1u64)); // cumulative 40_001 > 40_000
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

    #[test]
    fn release_reservation_rejects_cumulative_over_per_task_limit() {
        let mut w = setup();
        let provider_wallet = w.env.get_account(2);
        w.env.set_caller(provider_wallet);
        let provider = register(&mut w.identity, "ipfs://provider");
        fund_treasury(&mut w, 200_000);
        let deadline = w.env.block_time() + 1000;

        // Pay exactly PER_TASK (40_000) directly first.
        w.env.set_caller(w.admin);
        w.treasury.add_payee(provider);
        w.env.set_caller(w.agent);
        w.treasury.pay(1, provider, U256::from(40_000u64));

        // Now create a reservation for task 1 — small enough to fit free balance
        // and per-task single-reservation check (≤ per_task_limit), but release
        // would push cumulative task_spent over per_task_limit.
        let id = w.treasury.create_reservation(1, provider, U256::from(1u64), deadline);

        w.env.set_caller(w.admin);
        let result = w.treasury.try_release_reservation(id);
        assert_eq!(result, Err(super::Error::ExceedsTaskLimit.into()));
    }

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
}
