#![allow(dead_code)]
use odra::casper_types::U256;
use odra::prelude::*;

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

#[cfg(test)]
mod tests {
    use super::{AgentTreasury, AgentTreasuryHostRef, AgentTreasuryInitArgs};
    use crate::identity::{IdentityRegistry, IdentityRegistryHostRef};
    use odra::casper_types::U256;
    use odra::host::{Deployer, HostEnv, NoArgs};
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
}
