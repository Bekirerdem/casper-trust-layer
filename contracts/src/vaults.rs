use crate::identity::IdentityRegistryContractRef;
use crate::reputation::ReputationEngineContractRef;
use odra::casper_types::U256;
use odra::prelude::*;
use odra::ContractRef;
use odra_modules::cep18_token::Cep18ContractRef;

/// `get_block_time()` returns Unix MILLISECONDS, so a UTC day bucket divides by this.
const MS_PER_DAY: u64 = 86_400_000;
const MS_PER_HOUR: u64 = 3_600_000;
/// `per_day` is enforced over a rolling window of this many hourly buckets, so no
/// 23-hour stretch can exceed it (a calendar-day bucket allowed 2x across
/// midnight). The calendar bucket is still written for `spent_today`.
const WINDOW_HOURS: u64 = 24;

/// One customer's spending account: their money, their rules, their agent.
#[odra::odra_type]
pub struct Vault {
    /// The person who funded it. Only they can change rules, freeze or withdraw.
    pub owner: Address,
    /// The delegated spender — the only address allowed to call `pay`.
    pub agent: Address,
    pub per_job: U256,
    pub per_day: U256,
    /// A payee not on this vault's allow-list needs at least this earned score.
    /// Zero means allow-list only.
    pub min_track_record: U256,
    pub balance: U256,
    pub frozen: bool,
}

#[odra::odra_error]
pub enum Error {
    NotOwner = 1,
    NotAgent = 2,
    ZeroAmount = 3,
    VaultNotFound = 4,
    /// Payee is neither on the allow-list nor has enough earned track record.
    PayeeNotAllowed = 5,
    ExceedsJobLimit = 6,
    ExceedsDailyLimit = 7,
    InsufficientBalance = 8,
    /// The owner froze this vault.
    Frozen = 9,
    /// One vault per owner keeps the dashboard unambiguous.
    VaultAlreadyExists = 10,
    /// Limits must be non-zero with per-job <= per-day.
    InvalidLimits = 11,
    /// The payee identity is missing, slashed, withdrawn or unbonding.
    PayeeNotActive = 12,
}

/// Many customers, one contract.
///
/// Deploying a contract per customer is how this works on chains with cheap
/// factories; on Casper it would mean every user paying an install. Instead each
/// customer gets a vault inside this contract: their own balance, their own
/// limits, their own agent, their own freeze switch. Nobody can touch anybody
/// else's — ownership is checked on every state-changing call.
#[allow(dead_code)]
#[odra::module(
    errors = Error,
    events = [VaultOpened, Deposited, Withdrawn, Paid, RulesChanged, FreezeChanged, AgentChanged, PayeeChanged]
)]
pub struct AgentVaults {
    identity: Var<Address>,
    reputation: Var<Address>,
    token: Var<Address>,
    vaults: Mapping<u32, Vault>,
    count: Var<u32>,
    /// owner address → vault id + 1 (zero means "no vault", so ids stay 0-based).
    owner_index: Mapping<Address, u32>,
    /// (vault, UTC day) → spent. Keys are packed because Odra maps take one key.
    day_spent: Mapping<u64, U256>,
    /// Retired in v2: the packed key dropped a task id's upper 32 bits. Kept so
    /// later storage indices do not move; `task_spent` replaces it.
    job_spent: Mapping<u64, U256>,
    /// (vault, agent id) → always allowed, no track record needed.
    allow_list: Mapping<u64, bool>,
    // ---- v2 — appended so earlier storage indices stay valid off-chain ----
    /// (vault, hour bucket) → spent. Backs the rolling 24h cap.
    hour_spent: Mapping<(u32, u64), U256>,
    /// (vault, task) → spent, so a job's ceiling holds across several payments.
    task_spent: Mapping<(u32, u64), U256>,
    /// (vault, payee) → identity `transfer_count` when allowed. A transfer of the
    /// payee identity voids the allow-list entry.
    allow_epoch: Mapping<(u32, u32), u32>,
}

fn pack(vault_id: u32, other: u64) -> u64 {
    (other << 32) | (vault_id as u64)
}

#[odra::module]
impl AgentVaults {
    pub fn init(&mut self, identity: Address, reputation: Address, token: Address) {
        self.identity.set(identity);
        self.reputation.set(reputation);
        self.token.set(token);
    }

    // ---- opening an account ----------------------------------------------------

    /// Opens the caller's vault and returns its id. The caller is the owner; the
    /// agent may be the same address (self-managed) or a separate key.
    pub fn open_vault(
        &mut self,
        agent: Address,
        per_job: U256,
        per_day: U256,
        min_track_record: U256,
    ) -> u32 {
        let owner = self.env().caller();
        if self.owner_index.get(&owner).unwrap_or_default() > 0 {
            self.env().revert(Error::VaultAlreadyExists);
        }
        self.check_limits(per_job, per_day);
        let id = self.count.get_or_default();
        self.vaults.set(
            &id,
            Vault {
                owner,
                agent,
                per_job,
                per_day,
                min_track_record,
                balance: U256::zero(),
                frozen: false,
            },
        );
        self.owner_index.set(&owner, id + 1);
        self.count.set(id + 1);
        self.env().emit_event(VaultOpened { vault_id: id, owner, agent });
        id
    }

    /// Moves CEP-18 funds into a vault. The caller must have approved this
    /// contract for `amount` first — the same two-step every token spend uses.
    pub fn deposit(&mut self, vault_id: u32, amount: U256) {
        if amount.is_zero() {
            self.env().revert(Error::ZeroAmount);
        }
        let mut v = self.load(vault_id);
        let caller = self.env().caller();
        let this = self.env().self_address();
        self.token_ref().transfer_from(&caller, &this, &amount);
        v.balance += amount;
        self.vaults.set(&vault_id, v);
        self.env().emit_event(Deposited { vault_id, amount });
    }

    pub fn withdraw(&mut self, vault_id: u32, amount: U256) {
        let mut v = self.load(vault_id);
        self.only_owner(&v);
        if amount > v.balance {
            self.env().revert(Error::InsufficientBalance);
        }
        v.balance -= amount;
        let owner = v.owner;
        self.vaults.set(&vault_id, v);
        self.token_ref().transfer(&owner, &amount);
        self.env().emit_event(Withdrawn { vault_id, amount });
    }

    // ---- the owner's controls --------------------------------------------------

    pub fn set_rules(
        &mut self,
        vault_id: u32,
        per_job: U256,
        per_day: U256,
        min_track_record: U256,
    ) {
        let mut v = self.load(vault_id);
        self.only_owner(&v);
        self.check_limits(per_job, per_day);
        v.per_job = per_job;
        v.per_day = per_day;
        v.min_track_record = min_track_record;
        self.vaults.set(&vault_id, v);
        self.env().emit_event(RulesChanged { vault_id, per_job, per_day, min_track_record });
    }

    /// Hands spending to a different agent — or takes it back by pointing at the owner.
    pub fn set_agent(&mut self, vault_id: u32, agent: Address) {
        let mut v = self.load(vault_id);
        self.only_owner(&v);
        v.agent = agent;
        self.vaults.set(&vault_id, v);
        self.env().emit_event(AgentChanged { vault_id, agent });
    }

    /// Always allow `payee` — tied to the identity's current owner: if the
    /// identity is transferred, the entry stops applying.
    pub fn allow_payee(&mut self, vault_id: u32, payee: u32) {
        let v = self.load(vault_id);
        self.only_owner(&v);
        let epoch = self.identity_ref().transfer_count(payee);
        self.allow_list.set(&pack(vault_id, payee as u64), true);
        self.allow_epoch.set(&(vault_id, payee), epoch);
        self.env().emit_event(PayeeChanged { vault_id, payee, allowed: true });
    }

    pub fn disallow_payee(&mut self, vault_id: u32, payee: u32) {
        let v = self.load(vault_id);
        self.only_owner(&v);
        self.allow_list.set(&pack(vault_id, payee as u64), false);
        self.env().emit_event(PayeeChanged { vault_id, payee, allowed: false });
    }

    /// Stops every payment from this vault. Funds stay where they are.
    pub fn freeze(&mut self, vault_id: u32) {
        self.set_frozen(vault_id, true);
    }

    pub fn unfreeze(&mut self, vault_id: u32) {
        self.set_frozen(vault_id, false);
    }

    // ---- spending --------------------------------------------------------------

    /// The vault's agent pays `payee` for `task_id`. Every rule the owner set is
    /// checked here — this is the only path money can leave by. `per_job` caps
    /// each single payment AND the running total per task id, so rotating task
    /// ids does not lift it; `per_day` holds over any rolling 24 hours.
    pub fn pay(&mut self, vault_id: u32, task_id: u64, payee: u32, amount: U256) {
        let mut v = self.load(vault_id);
        if self.env().caller() != v.agent {
            self.env().revert(Error::NotAgent);
        }
        if v.frozen {
            self.env().revert(Error::Frozen);
        }
        if amount.is_zero() {
            self.env().revert(Error::ZeroAmount);
        }
        self.assert_payee_allowed(vault_id, &v, payee);

        let job_so_far = self.task_spent.get(&(vault_id, task_id)).unwrap_or_default();
        if amount > v.per_job || job_so_far + amount > v.per_job {
            self.env().revert(Error::ExceedsJobLimit);
        }

        if self.window_spent(vault_id) + amount > v.per_day {
            self.env().revert(Error::ExceedsDailyLimit);
        }

        if amount > v.balance {
            self.env().revert(Error::InsufficientBalance);
        }

        // EFFECTS before INTERACTION.
        self.task_spent.set(&(vault_id, task_id), job_so_far + amount);
        self.record_spend(vault_id, amount);
        v.balance -= amount;
        self.vaults.set(&vault_id, v);

        let wallet = self.identity_ref().get_agent_wallet(payee);
        self.token_ref().transfer(&wallet, &amount);
        self.env().emit_event(Paid { vault_id, task_id, payee, amount });
    }

    // ---- views -----------------------------------------------------------------

    pub fn get_vault(&self, vault_id: u32) -> Option<Vault> {
        self.vaults.get(&vault_id)
    }

    /// The caller-facing lookup a dashboard needs: which vault belongs to whom.
    pub fn vault_of(&self, owner: Address) -> Option<u32> {
        match self.owner_index.get(&owner).unwrap_or_default() {
            0 => None,
            n => Some(n - 1),
        }
    }

    pub fn total_vaults(&self) -> u32 {
        self.count.get_or_default()
    }

    /// Spent in the current UTC calendar day (display only — the cap is rolling).
    pub fn spent_today(&self, vault_id: u32) -> U256 {
        self.day_spent.get(&pack(vault_id, self.today())).unwrap_or_default()
    }

    /// Spent over the rolling window `per_day` is enforced against.
    pub fn spent_last_24h(&self, vault_id: u32) -> U256 {
        self.window_spent(vault_id)
    }

    pub fn spent_on_job(&self, vault_id: u32, task_id: u64) -> U256 {
        self.task_spent.get(&(vault_id, task_id)).unwrap_or_default()
    }

    pub fn is_payee_allowed(&self, vault_id: u32, payee: u32) -> bool {
        self.allow_list.get(&pack(vault_id, payee as u64)).unwrap_or_default()
            && self.allow_epoch.get(&(vault_id, payee)).unwrap_or_default()
                == self.identity_ref().transfer_count(payee)
    }

    // ---- internals -------------------------------------------------------------

    fn set_frozen(&mut self, vault_id: u32, frozen: bool) {
        let mut v = self.load(vault_id);
        self.only_owner(&v);
        v.frozen = frozen;
        self.vaults.set(&vault_id, v);
        self.env().emit_event(FreezeChanged { vault_id, frozen });
    }

    fn load(&self, vault_id: u32) -> Vault {
        match self.vaults.get(&vault_id) {
            Some(v) => v,
            None => self.env().revert(Error::VaultNotFound),
        }
    }

    fn only_owner(&self, v: &Vault) {
        if self.env().caller() != v.owner {
            self.env().revert(Error::NotOwner);
        }
    }

    /// Allow-list first, then earned track record. A vault with no track-record
    /// requirement is allow-list only, which is the safest default.
    fn assert_payee_allowed(&self, vault_id: u32, v: &Vault, payee: u32) {
        if !self.identity_ref().is_active(payee) {
            self.env().revert(Error::PayeeNotActive);
        }
        if self.is_payee_allowed(vault_id, payee) {
            return;
        }
        if v.min_track_record.is_zero() {
            self.env().revert(Error::PayeeNotAllowed);
        }
        let reputation = self.reputation.get().unwrap_or_revert(self);
        let score = ReputationEngineContractRef::new(self.env(), reputation).score(payee);
        if score < v.min_track_record {
            self.env().revert(Error::PayeeNotAllowed);
        }
    }

    fn today(&self) -> u64 {
        self.env().get_block_time() / MS_PER_DAY
    }

    /// Sum of the vault's last `WINDOW_HOURS` hourly buckets (current included).
    fn window_spent(&self, vault_id: u32) -> U256 {
        let hour = self.env().get_block_time() / MS_PER_HOUR;
        let mut sum = U256::zero();
        for h in hour.saturating_sub(WINDOW_HOURS - 1)..=hour {
            sum += self.hour_spent.get(&(vault_id, h)).unwrap_or_default();
        }
        sum
    }

    fn record_spend(&mut self, vault_id: u32, amount: U256) {
        let now = self.env().get_block_time();
        let hour_key = (vault_id, now / MS_PER_HOUR);
        let day_key = pack(vault_id, now / MS_PER_DAY);
        self.hour_spent.set(&hour_key, self.hour_spent.get(&hour_key).unwrap_or_default() + amount);
        self.day_spent.set(&day_key, self.day_spent.get(&day_key).unwrap_or_default() + amount);
    }

    fn check_limits(&self, per_job: U256, per_day: U256) {
        if per_job.is_zero() || per_day.is_zero() || per_job > per_day {
            self.env().revert(Error::InvalidLimits);
        }
    }

    fn token_ref(&self) -> Cep18ContractRef {
        Cep18ContractRef::new(self.env(), self.token.get().unwrap_or_revert(self))
    }

    fn identity_ref(&self) -> IdentityRegistryContractRef {
        IdentityRegistryContractRef::new(self.env(), self.identity.get().unwrap_or_revert(self))
    }
}

#[odra::event]
pub struct VaultOpened {
    pub vault_id: u32,
    pub owner: Address,
    pub agent: Address,
}

#[odra::event]
pub struct Deposited {
    pub vault_id: u32,
    pub amount: U256,
}

#[odra::event]
pub struct Withdrawn {
    pub vault_id: u32,
    pub amount: U256,
}

#[odra::event]
pub struct Paid {
    pub vault_id: u32,
    pub task_id: u64,
    pub payee: u32,
    pub amount: U256,
}

#[odra::event]
pub struct RulesChanged {
    pub vault_id: u32,
    pub per_job: U256,
    pub per_day: U256,
    pub min_track_record: U256,
}

#[odra::event]
pub struct FreezeChanged {
    pub vault_id: u32,
    pub frozen: bool,
}

#[odra::event]
pub struct AgentChanged {
    pub vault_id: u32,
    pub agent: Address,
}

#[odra::event]
pub struct PayeeChanged {
    pub vault_id: u32,
    pub payee: u32,
    pub allowed: bool,
}

#[cfg(test)]
mod tests {
    use super::{AgentVaults, AgentVaultsHostRef, AgentVaultsInitArgs, Error};
    use crate::identity::{IdentityRegistry, IdentityRegistryHostRef, MIN_BOND};
    use crate::reputation::{ReputationEngine, ReputationEngineInitArgs};
    use odra::casper_types::{U256, U512};
    use odra::host::{Deployer, HostEnv, HostRef, NoArgs};
    use odra::prelude::{Address, Addressable};
    use odra_modules::cep18_token::{Cep18, Cep18HostRef, Cep18InitArgs};

    const SUPPLY: u64 = 1_000_000_000;
    const PER_DAY: u64 = 100_000;
    const PER_JOB: u64 = 40_000;

    struct World {
        env: HostEnv,
        identity: IdentityRegistryHostRef,
        token: Cep18HostRef,
        vaults: AgentVaultsHostRef,
        alice: Address,
        bob: Address,
    }

    fn setup() -> World {
        let env = odra_test::env();
        let alice = env.get_account(0);
        let bob = env.get_account(1);

        env.set_caller(alice);
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
        let reputation = ReputationEngine::deploy(
            &env,
            ReputationEngineInitArgs { identity: identity.address() },
        );
        let vaults = AgentVaults::deploy(
            &env,
            AgentVaultsInitArgs {
                identity: identity.address(),
                reputation: reputation.address(),
                token: token.address(),
            },
        );
        World { env, identity, token, vaults, alice, bob }
    }

    fn register(identity: &mut IdentityRegistryHostRef, uri: &str) -> u32 {
        let mut bonded = identity.with_tokens(U512::from(MIN_BOND));
        bonded.register(uri.to_string())
    }

    /// Opens a vault for `who`, funds it, and returns its id. The owner is also
    /// the agent here, which is the self-managed case the dashboard defaults to.
    fn open_funded_vault(w: &mut World, who: Address, amount: u64) -> u32 {
        w.env.set_caller(who);
        let id = w.vaults.open_vault(
            who,
            U256::from(PER_JOB),
            U256::from(PER_DAY),
            U256::from(1u64),
        );
        // Alice holds the initial supply; CEP-18 rejects a self-transfer, so only
        // top up when the vault owner is somebody else.
        if who != w.alice {
            w.env.set_caller(w.alice);
            w.token.transfer(&who, &U256::from(amount));
        }
        w.env.set_caller(who);
        w.token.approve(&w.vaults.address(), &U256::from(amount));
        w.vaults.deposit(id, U256::from(amount));
        id
    }

    #[test]
    fn each_owner_gets_their_own_vault() {
        let mut w = setup();
        let who_alice = w.alice;
        let a = open_funded_vault(&mut w, who_alice, 50_000);
        let who_bob = w.bob;
        let b = open_funded_vault(&mut w, who_bob, 10_000);

        assert_ne!(a, b);
        assert_eq!(w.vaults.vault_of(w.alice), Some(a));
        assert_eq!(w.vaults.vault_of(w.bob), Some(b));
        assert_eq!(w.vaults.get_vault(a).unwrap().balance, U256::from(50_000));
        assert_eq!(w.vaults.get_vault(b).unwrap().balance, U256::from(10_000));
        assert_eq!(w.vaults.total_vaults(), 2);
    }

    #[test]
    fn a_stranger_cannot_touch_your_vault() {
        let mut w = setup();
        let who_alice = w.alice;
        let alices = open_funded_vault(&mut w, who_alice, 50_000);

        // Bob tries every owner-only control on Alice's vault.
        w.env.set_caller(w.bob);
        assert_eq!(w.vaults.try_freeze(alices), Err(Error::NotOwner.into()));
        assert_eq!(
            w.vaults.try_withdraw(alices, U256::from(1u64)),
            Err(Error::NotOwner.into())
        );
        assert_eq!(
            w.vaults.try_set_rules(alices, U256::from(9u64), U256::from(9u64), U256::zero()),
            Err(Error::NotOwner.into())
        );
        assert_eq!(w.vaults.try_allow_payee(alices, 0), Err(Error::NotOwner.into()));

        // ...and tries to spend from it.
        assert_eq!(
            w.vaults.try_pay(alices, 1, 0, U256::from(1u64)),
            Err(Error::NotAgent.into())
        );

        // Nothing moved.
        assert_eq!(w.vaults.get_vault(alices).unwrap().balance, U256::from(50_000));
        assert!(!w.vaults.get_vault(alices).unwrap().frozen);
    }

    #[test]
    fn one_vault_per_owner() {
        let mut w = setup();
        let who_alice = w.alice;
        open_funded_vault(&mut w, who_alice, 1_000);
        w.env.set_caller(w.alice);
        let second = w.vaults.try_open_vault(
            w.alice,
            U256::from(1u64),
            U256::from(1u64),
            U256::zero(),
        );
        assert_eq!(second, Err(Error::VaultAlreadyExists.into()));
    }

    #[test]
    fn owners_rules_are_independent() {
        let mut w = setup();
        let who_alice = w.alice;
        let alices = open_funded_vault(&mut w, who_alice, 50_000);
        let who_bob = w.bob;
        let bobs = open_funded_vault(&mut w, who_bob, 50_000);

        // Alice loosens hers; Bob's stays where it was.
        w.env.set_caller(w.alice);
        w.vaults.set_rules(alices, U256::from(90_000u64), U256::from(90_000u64), U256::zero());

        assert_eq!(w.vaults.get_vault(alices).unwrap().per_job, U256::from(90_000));
        assert_eq!(w.vaults.get_vault(bobs).unwrap().per_job, U256::from(PER_JOB));
    }

    #[test]
    fn allowed_payee_is_paid_and_spend_is_tracked_per_vault() {
        let mut w = setup();
        let who_alice = w.alice;
        let alices = open_funded_vault(&mut w, who_alice, 50_000);
        let who_bob = w.bob;
        let bobs = open_funded_vault(&mut w, who_bob, 50_000);

        let provider_wallet = w.env.get_account(2);
        w.env.set_caller(provider_wallet);
        let provider = register(&mut w.identity, "ipfs://provider");

        w.env.set_caller(w.alice);
        w.vaults.allow_payee(alices, provider);
        w.vaults.pay(alices, 1, provider, U256::from(10_000u64));

        assert_eq!(w.token.balance_of(&provider_wallet), U256::from(10_000));
        assert_eq!(w.vaults.spent_today(alices), U256::from(10_000));
        // Bob's vault is untouched by Alice's spending.
        assert_eq!(w.vaults.spent_today(bobs), U256::zero());
        assert_eq!(w.vaults.get_vault(bobs).unwrap().balance, U256::from(50_000));
    }

    #[test]
    fn payee_without_track_record_is_refused() {
        let mut w = setup();
        let who_alice = w.alice;
        let alices = open_funded_vault(&mut w, who_alice, 50_000);

        let stranger_wallet = w.env.get_account(3);
        w.env.set_caller(stranger_wallet);
        let stranger = register(&mut w.identity, "ipfs://stranger");

        // Not on the allow-list, and its earned score is zero.
        w.env.set_caller(w.alice);
        assert_eq!(
            w.vaults.try_pay(alices, 1, stranger, U256::from(10u64)),
            Err(Error::PayeeNotAllowed.into())
        );
        assert_eq!(w.vaults.get_vault(alices).unwrap().balance, U256::from(50_000));
    }

    #[test]
    fn limits_hold_per_job_and_per_day() {
        let mut w = setup();
        let who_alice = w.alice;
        let alices = open_funded_vault(&mut w, who_alice, 500_000);
        let provider_wallet = w.env.get_account(2);
        w.env.set_caller(provider_wallet);
        let provider = register(&mut w.identity, "ipfs://provider");

        w.env.set_caller(w.alice);
        w.vaults.allow_payee(alices, provider);

        // Over the per-job ceiling in one go.
        assert_eq!(
            w.vaults.try_pay(alices, 1, provider, U256::from(PER_JOB + 1)),
            Err(Error::ExceedsJobLimit.into())
        );

        // Cumulative across the same job id also counts.
        w.vaults.pay(alices, 1, provider, U256::from(PER_JOB));
        assert_eq!(
            w.vaults.try_pay(alices, 1, provider, U256::from(1u64)),
            Err(Error::ExceedsJobLimit.into())
        );

        // Fresh jobs draw down the daily ceiling until it is gone.
        w.vaults.pay(alices, 2, provider, U256::from(PER_JOB));
        assert_eq!(
            w.vaults.try_pay(alices, 3, provider, U256::from(PER_JOB)),
            Err(Error::ExceedsDailyLimit.into())
        );
    }

    #[test]
    fn freezing_stops_spending_and_only_the_owner_can_do_it() {
        let mut w = setup();
        let who_alice = w.alice;
        let alices = open_funded_vault(&mut w, who_alice, 50_000);
        let provider_wallet = w.env.get_account(2);
        w.env.set_caller(provider_wallet);
        let provider = register(&mut w.identity, "ipfs://provider");

        w.env.set_caller(w.alice);
        w.vaults.allow_payee(alices, provider);
        w.vaults.freeze(alices);

        assert_eq!(
            w.vaults.try_pay(alices, 1, provider, U256::from(10u64)),
            Err(Error::Frozen.into())
        );

        w.env.set_caller(w.alice);
        w.vaults.unfreeze(alices);
        assert!(w.vaults.try_pay(alices, 1, provider, U256::from(10u64)).is_ok());
    }

    #[test]
    fn owner_can_take_their_money_back() {
        let mut w = setup();
        let who_alice = w.alice;
        let alices = open_funded_vault(&mut w, who_alice, 50_000);
        let before = w.token.balance_of(&w.alice);

        w.env.set_caller(w.alice);
        w.vaults.withdraw(alices, U256::from(20_000u64));

        assert_eq!(w.token.balance_of(&w.alice), before + U256::from(20_000));
        assert_eq!(w.vaults.get_vault(alices).unwrap().balance, U256::from(30_000));
    }

    #[test]
    fn spending_cannot_exceed_the_vaults_own_balance() {
        let mut w = setup();
        let who_alice = w.alice;
        let alices = open_funded_vault(&mut w, who_alice, 5_000);
        let provider_wallet = w.env.get_account(2);
        w.env.set_caller(provider_wallet);
        let provider = register(&mut w.identity, "ipfs://provider");

        w.env.set_caller(w.alice);
        w.vaults.allow_payee(alices, provider);
        // Inside both ceilings, but more than this vault holds.
        assert_eq!(
            w.vaults.try_pay(alices, 1, provider, U256::from(6_000u64)),
            Err(Error::InsufficientBalance.into())
        );
    }

    // ---- v2: attacks from the v1 audit ----------------------------------------------

    fn ready_payee(w: &mut World, vault: u32) -> (u32, Address) {
        let provider_wallet = w.env.get_account(2);
        w.env.set_caller(provider_wallet);
        let provider = register(&mut w.identity, "ipfs://provider");
        w.env.set_caller(w.alice);
        w.vaults.allow_payee(vault, provider);
        (provider, provider_wallet)
    }

    /// B6 — rotating task ids used to lift the per-job ceiling. Each payment is
    /// now capped on its own, whatever task id it carries.
    #[test]
    fn task_id_rotation_does_not_lift_the_per_job_cap() {
        let mut w = setup();
        let who_alice = w.alice;
        let alices = open_funded_vault(&mut w, who_alice, 500_000);
        let (provider, _) = ready_payee(&mut w, alices);

        w.env.set_caller(w.alice);
        for task in [10u64, 11, 12] {
            assert_eq!(
                w.vaults.try_pay(alices, task, provider, U256::from(PER_JOB + 1)),
                Err(Error::ExceedsJobLimit.into())
            );
        }
    }

    /// B16 — task ids that differ only in their upper 32 bits used to share one
    /// counter. They are separate jobs now.
    #[test]
    fn large_task_ids_do_not_collide() {
        let mut w = setup();
        let who_alice = w.alice;
        let alices = open_funded_vault(&mut w, who_alice, 500_000);
        let (provider, _) = ready_payee(&mut w, alices);

        w.env.set_caller(w.alice);
        w.vaults.pay(alices, 1, provider, U256::from(10_000u64));
        assert_eq!(w.vaults.spent_on_job(alices, 1 + (1u64 << 32)), U256::zero());
        assert_eq!(w.vaults.spent_on_job(alices, 1), U256::from(10_000u64));
    }

    /// B7 — per_day at 23:59, again at 00:01: refused by the rolling window.
    #[test]
    fn midnight_double_spend_is_refused() {
        let mut w = setup();
        let who_alice = w.alice;
        let alices = open_funded_vault(&mut w, who_alice, 500_000);
        let (provider, _) = ready_payee(&mut w, alices);
        let now = w.env.block_time();
        w.env.advance_block_time(super::MS_PER_DAY - (now % super::MS_PER_DAY) - 60_000);

        w.env.set_caller(w.alice);
        w.vaults.pay(alices, 1, provider, U256::from(PER_JOB));
        w.vaults.pay(alices, 2, provider, U256::from(PER_JOB));
        w.vaults.pay(alices, 3, provider, U256::from(PER_DAY - 2 * PER_JOB));

        w.env.advance_block_time(120_000);
        assert_eq!(w.vaults.spent_today(alices), U256::zero());
        assert_eq!(w.vaults.spent_last_24h(alices), U256::from(PER_DAY));
        assert_eq!(
            w.vaults.try_pay(alices, 4, provider, U256::from(1u64)),
            Err(Error::ExceedsDailyLimit.into())
        );

        w.env.advance_block_time(24 * super::MS_PER_HOUR);
        assert!(w.vaults.try_pay(alices, 4, provider, U256::from(PER_JOB)).is_ok());
    }

    /// B4 — an allow-listed payee that is unbonding (or slashed) is refused.
    #[test]
    fn inactive_payee_is_refused_even_if_allowed() {
        let mut w = setup();
        let who_alice = w.alice;
        let alices = open_funded_vault(&mut w, who_alice, 50_000);
        let (provider, provider_wallet) = ready_payee(&mut w, alices);

        w.env.set_caller(provider_wallet);
        w.identity.request_withdraw(provider);

        w.env.set_caller(w.alice);
        assert_eq!(
            w.vaults.try_pay(alices, 1, provider, U256::from(10u64)),
            Err(Error::PayeeNotActive.into())
        );
    }

    /// B14 — an allow-listed identity that is sold no longer passes the list.
    #[test]
    fn allow_list_does_not_survive_a_transfer() {
        let mut w = setup();
        let who_alice = w.alice;
        let alices = open_funded_vault(&mut w, who_alice, 50_000);
        let (provider, provider_wallet) = ready_payee(&mut w, alices);
        assert!(w.vaults.is_payee_allowed(alices, provider));

        let buyer = w.env.get_account(7);
        w.env.set_caller(provider_wallet);
        w.identity.transfer(provider, buyer);
        w.env.set_caller(buyer);
        w.identity.accept_transfer(provider);

        assert!(!w.vaults.is_payee_allowed(alices, provider));
        // min_track_record = 1 and the buyer has no score: refused.
        w.env.set_caller(w.alice);
        assert_eq!(
            w.vaults.try_pay(alices, 1, provider, U256::from(10u64)),
            Err(Error::PayeeNotAllowed.into())
        );
    }

    /// B17 — nonsensical rules are refused.
    #[test]
    fn rules_are_sanity_checked() {
        let mut w = setup();
        w.env.set_caller(w.bob);
        assert_eq!(
            w.vaults.try_open_vault(w.bob, U256::from(2u64), U256::from(1u64), U256::zero()),
            Err(Error::InvalidLimits.into())
        );
        let who_alice = w.alice;
        let alices = open_funded_vault(&mut w, who_alice, 1_000);
        w.env.set_caller(w.alice);
        assert_eq!(
            w.vaults.try_set_rules(alices, U256::zero(), U256::zero(), U256::zero()),
            Err(Error::InvalidLimits.into())
        );
    }

    #[test]
    fn changing_the_agent_hands_over_spending() {
        let mut w = setup();
        let who_alice = w.alice;
        let alices = open_funded_vault(&mut w, who_alice, 50_000);
        let (provider, _) = ready_payee(&mut w, alices);
        let new_agent = w.env.get_account(5);

        w.env.set_caller(w.alice);
        w.vaults.set_agent(alices, new_agent);
        assert_eq!(
            w.vaults.try_pay(alices, 1, provider, U256::from(10u64)),
            Err(Error::NotAgent.into())
        );
        w.env.set_caller(new_agent);
        assert!(w.vaults.try_pay(alices, 1, provider, U256::from(10u64)).is_ok());
    }
}
