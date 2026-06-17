use crate::identity::IdentityRegistryContractRef;
use crate::reputation::ReputationEngineContractRef;
use odra::casper_types::U256;
use odra::prelude::*;
use odra::ContractRef;
use odra_modules::cep18_token::Cep18ContractRef;

/// Protocol fee burned on settlement (basis points). Makes wash-trading lose
/// value on every hop even though the round-trip capital returns.
const FEE_BPS: u64 = 200; // 2%

/// Lifecycle of an escrowed job. The settled (`Released`) transition is the
/// objective, payment-backed signal the ReputationEngine derives scores from.
#[odra::odra_type]
pub enum JobState {
    Funded,
    Submitted,
    Released,
    Refunded,
}

/// An escrowed unit of work between two agent identities. Both `client_id` and
/// `provider` are agent ids, so reputation (provider) and trust-weight (client)
/// attach to transferable identities.
#[odra::odra_type]
pub struct Job {
    pub client_id: u32,
    pub provider: u32,
    pub amount: U256,
    pub result_hash: String,
    pub deadline: u64,
    pub state: JobState,
}

/// Error variants for the escrow.
#[odra::odra_error]
pub enum Error {
    JobNotFound = 1,
    NotClient = 2,
    NotProvider = 3,
    InvalidState = 4,
    DeadlineNotReached = 5,
    DeadlinePassed = 6,
    ZeroAmount = 7,
    /// A client may not hire itself.
    SelfHire = 8,
}

/// Escrow that locks a client agent's CEP-18 funds against a provider agent's
/// work. On settlement it pays the provider's wallet (resolved from the
/// IdentityRegistry), burns a fee, and reports the settlement to the
/// ReputationEngine. On a deadline default it refunds the client and slashes the
/// provider's bond.
#[odra::module(errors = Error, events = [JobCreated, WorkSubmitted, JobReleased, JobRefunded])]
pub struct Escrow {
    identity: Var<Address>,
    reputation: Var<Address>,
    token: Var<Address>,
    jobs: Mapping<u64, Job>,
    count: Var<u64>,
}

#[odra::module]
impl Escrow {
    pub fn init(&mut self, identity: Address, reputation: Address, token: Address) {
        self.identity.set(identity);
        self.reputation.set(reputation);
        self.token.set(token);
    }

    /// Client agent creates and funds a job hiring `provider`. Caller must be the
    /// client's operational wallet; it must have approved the escrow for `amount`.
    pub fn create_job(&mut self, client_id: u32, provider: u32, amount: U256, deadline: u64) -> u64 {
        if amount.is_zero() {
            self.env().revert(Error::ZeroAmount);
        }
        if provider == client_id {
            self.env().revert(Error::SelfHire);
        }
        let caller = self.env().caller();
        if caller != self.agent_wallet(client_id) {
            self.env().revert(Error::NotClient);
        }

        let id = self.count.get_or_default();
        self.jobs.set(
            &id,
            Job {
                client_id,
                provider,
                amount,
                result_hash: String::new(),
                deadline,
                state: JobState::Funded,
            },
        );
        self.count.set(id + 1);

        self.token_ref()
            .transfer_from(&caller, &self.env().self_address(), &amount);

        self.env().emit_event(JobCreated { job_id: id, client_id, provider, amount });
        id
    }

    /// Provider agent submits the deliverable hash (from its wallet). Before deadline.
    pub fn submit_work(&mut self, job_id: u64, result_hash: String) {
        let mut job = self.load(job_id);
        if self.env().caller() != self.agent_wallet(job.provider) {
            self.env().revert(Error::NotProvider);
        }
        if job.state != JobState::Funded {
            self.env().revert(Error::InvalidState);
        }
        if self.env().get_block_time() >= job.deadline {
            self.env().revert(Error::DeadlinePassed);
        }
        job.result_hash = result_hash;
        job.state = JobState::Submitted;
        self.jobs.set(&job_id, job);
        self.env().emit_event(WorkSubmitted { job_id });
    }

    /// Client approves the work, settling funds to the provider.
    pub fn approve(&mut self, job_id: u64) {
        let mut job = self.load(job_id);
        if self.env().caller() != self.agent_wallet(job.client_id) {
            self.env().revert(Error::NotClient);
        }
        if job.state != JobState::Submitted {
            self.env().revert(Error::InvalidState);
        }
        let (client_id, provider, amount) = (job.client_id, job.provider, job.amount);
        job.state = JobState::Released;
        self.jobs.set(&job_id, job);
        self.settle(job_id, client_id, provider, amount);
    }

    /// After the deadline with no submission, the client reclaims the funds and
    /// the defaulting provider's bond is slashed.
    pub fn refund(&mut self, job_id: u64) {
        let mut job = self.load(job_id);
        let client_wallet = self.agent_wallet(job.client_id);
        if self.env().caller() != client_wallet {
            self.env().revert(Error::NotClient);
        }
        if job.state != JobState::Funded {
            self.env().revert(Error::InvalidState);
        }
        if self.env().get_block_time() < job.deadline {
            self.env().revert(Error::DeadlineNotReached);
        }
        let (client_id, provider, amount) = (job.client_id, job.provider, job.amount);
        job.state = JobState::Refunded;
        self.jobs.set(&job_id, job);

        self.token_ref().transfer(&client_wallet, &amount);
        self.identity_ref().slash(provider);
        self.env().emit_event(JobRefunded { job_id, client_id, amount });
    }

    /// After the deadline, a provider that submitted but was never approved can
    /// claim payment (protects the provider from an unresponsive client).
    pub fn claim(&mut self, job_id: u64) {
        let mut job = self.load(job_id);
        if self.env().caller() != self.agent_wallet(job.provider) {
            self.env().revert(Error::NotProvider);
        }
        if job.state != JobState::Submitted {
            self.env().revert(Error::InvalidState);
        }
        if self.env().get_block_time() < job.deadline {
            self.env().revert(Error::DeadlineNotReached);
        }
        let (client_id, provider, amount) = (job.client_id, job.provider, job.amount);
        job.state = JobState::Released;
        self.jobs.set(&job_id, job);
        self.settle(job_id, client_id, provider, amount);
    }

    // ---- views ----------------------------------------------------------------

    pub fn get_job(&self, job_id: u64) -> Job {
        self.load(job_id)
    }

    pub fn total_jobs(&self) -> u64 {
        self.count.get_or_default()
    }

    // ---- internal -------------------------------------------------------------

    /// Pays the provider (net of fee), retains the burned fee, and reports the
    /// gross settlement to the ReputationEngine.
    fn settle(&self, job_id: u64, client_id: u32, provider: u32, amount: U256) {
        let fee = amount * U256::from(FEE_BPS) / U256::from(10_000u64);
        let payout = amount - fee;
        let wallet = self.agent_wallet(provider);
        self.token_ref().transfer(&wallet, &payout); // fee stays locked in escrow
        self.reputation_ref().record_settlement(provider, client_id, amount);
        self.env().emit_event(JobReleased { job_id, client_id, provider, amount });
    }

    fn load(&self, job_id: u64) -> Job {
        self.jobs
            .get(&job_id)
            .unwrap_or_revert_with(self, Error::JobNotFound)
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

    fn reputation_ref(&self) -> ReputationEngineContractRef {
        ReputationEngineContractRef::new(self.env(), self.reputation.get().unwrap_or_revert(self))
    }
}

/// Emitted when a job is created and funded.
#[odra::event]
pub struct JobCreated {
    pub job_id: u64,
    pub client_id: u32,
    pub provider: u32,
    pub amount: U256,
}

/// Emitted when a provider submits work.
#[odra::event]
pub struct WorkSubmitted {
    pub job_id: u64,
}

/// Emitted when funds settle to the provider — the reputation signal.
#[odra::event]
pub struct JobReleased {
    pub job_id: u64,
    pub client_id: u32,
    pub provider: u32,
    pub amount: U256,
}

/// Emitted when funds are refunded to the client.
#[odra::event]
pub struct JobRefunded {
    pub job_id: u64,
    pub client_id: u32,
    pub amount: U256,
}

#[cfg(test)]
mod tests {
    use super::{Error, Escrow, EscrowHostRef, EscrowInitArgs, JobReleased, JobState, FEE_BPS};
    use crate::identity::{AgentStatus, IdentityRegistry, IdentityRegistryHostRef, MIN_BOND};
    use crate::reputation::{ReputationEngine, ReputationEngineHostRef, ReputationEngineInitArgs};
    use odra::casper_types::{U256, U512};
    use odra::host::{Deployer, HostEnv, HostRef, NoArgs};
    use odra::prelude::{Address, Addressable};
    use odra_modules::cep18_token::{Cep18, Cep18HostRef, Cep18InitArgs};

    const SUPPLY: u64 = 1_000_000;

    struct World {
        env: HostEnv,
        identity: IdentityRegistryHostRef,
        reputation: ReputationEngineHostRef,
        token: Cep18HostRef,
        escrow: EscrowHostRef,
        client_wallet: Address,
        provider_wallet: Address,
        client_id: u32,
        provider_id: u32,
    }

    fn register(identity: &mut IdentityRegistryHostRef, uri: &str) -> u32 {
        let mut bonded = identity.with_tokens(U512::from(MIN_BOND));
        bonded.register(uri.to_string())
    }

    fn setup() -> World {
        let env = odra_test::env();
        let admin = env.get_account(8);
        let client_wallet = env.get_account(0);
        let provider_wallet = env.get_account(1);

        // Token minted to the client wallet (funds the jobs).
        env.set_caller(client_wallet);
        let token = Cep18::deploy(
            &env,
            Cep18InitArgs {
                symbol: "TUSD".to_string(),
                name: "Test USD".to_string(),
                decimals: 6,
                initial_supply: U256::from(SUPPLY),
            },
        );

        // Trust layer, wired together.
        env.set_caller(admin);
        let mut identity = IdentityRegistry::deploy(&env, NoArgs);
        let mut reputation = ReputationEngine::deploy(&env, ReputationEngineInitArgs { identity: identity.address() });
        let escrow = Escrow::deploy(
            &env,
            EscrowInitArgs {
                identity: identity.address(),
                reputation: reputation.address(),
                token: token.address(),
            },
        );
        identity.set_escrow(escrow.address());
        reputation.set_escrow(escrow.address());

        // Register the two agents.
        env.set_caller(client_wallet);
        let client_id = register(&mut identity, "ipfs://client");
        env.set_caller(provider_wallet);
        let provider_id = register(&mut identity, "ipfs://provider");

        World { env, identity, reputation, token, escrow, client_wallet, provider_wallet, client_id, provider_id }
    }

    fn fund_job(w: &mut World, amount: u64, deadline: u64) -> u64 {
        w.env.set_caller(w.client_wallet);
        w.token.approve(&w.escrow.address(), &U256::from(amount));
        w.escrow.create_job(w.client_id, w.provider_id, U256::from(amount), deadline)
    }

    #[test]
    fn create_job_locks_funds_and_sets_funded() {
        let mut w = setup();
        let deadline = w.env.block_time() + 1000;

        let id = fund_job(&mut w, 1000, deadline);

        let job = w.escrow.get_job(id);
        assert_eq!(job.client_id, w.client_id);
        assert_eq!(job.provider, w.provider_id);
        assert_eq!(job.state, JobState::Funded);
        assert_eq!(w.token.balance_of(&w.escrow.address()), U256::from(1000u64));
        assert_eq!(w.token.balance_of(&w.client_wallet), U256::from(SUPPLY - 1000));
    }

    #[test]
    fn cannot_hire_self() {
        let mut w = setup();
        w.env.set_caller(w.client_wallet);
        w.token.approve(&w.escrow.address(), &U256::from(1000u64));
        let result = w.escrow.try_create_job(w.client_id, w.client_id, U256::from(1000u64), w.env.block_time() + 1000);
        assert_eq!(result, Err(Error::SelfHire.into()));
    }

    #[test]
    fn full_loop_pays_provider_burns_fee_and_updates_reputation() {
        let mut w = setup();
        let deadline = w.env.block_time() + 1000;
        let id = fund_job(&mut w, 1000, deadline);

        w.env.set_caller(w.provider_wallet);
        w.escrow.submit_work(id, "ipfs://result".to_string());
        w.env.set_caller(w.client_wallet);
        w.escrow.approve(id);

        let fee = 1000 * FEE_BPS / 10_000; // 20
        assert_eq!(w.escrow.get_job(id).state, JobState::Released);
        assert_eq!(w.token.balance_of(&w.provider_wallet), U256::from(1000 - fee)); // net of burn fee
        assert_eq!(w.token.balance_of(&w.escrow.address()), U256::from(fee)); // fee retained
        let rep = w.reputation.get_reputation(w.provider_id);
        assert_eq!(rep.jobs_completed, 1);
        assert!(rep.score_bps > U256::zero()); // bonded client confers bootstrap reputation
    }

    #[test]
    fn approve_emits_job_released_event() {
        let mut w = setup();
        let deadline = w.env.block_time() + 1000;
        let id = fund_job(&mut w, 1000, deadline);
        w.env.set_caller(w.provider_wallet);
        w.escrow.submit_work(id, "ipfs://result".to_string());
        w.env.set_caller(w.client_wallet);
        w.escrow.approve(id);

        assert!(w.env.emitted_event(
            &w.escrow,
            JobReleased { job_id: id, client_id: w.client_id, provider: w.provider_id, amount: U256::from(1000u64) }
        ));
    }

    #[test]
    fn submit_work_rejects_non_provider() {
        let mut w = setup();
        let deadline = w.env.block_time() + 1000;
        let id = fund_job(&mut w, 1000, deadline);

        w.env.set_caller(w.client_wallet);
        let result = w.escrow.try_submit_work(id, "ipfs://x".to_string());
        assert_eq!(result, Err(Error::NotProvider.into()));
    }

    #[test]
    fn refund_after_deadline_returns_funds_and_slashes_provider() {
        let mut w = setup();
        let deadline = w.env.block_time() + 1000;
        let id = fund_job(&mut w, 1000, deadline);

        w.env.advance_block_time(2000);
        w.env.set_caller(w.client_wallet);
        w.escrow.refund(id);

        assert_eq!(w.escrow.get_job(id).state, JobState::Refunded);
        assert_eq!(w.token.balance_of(&w.client_wallet), U256::from(SUPPLY)); // full refund
        // provider's bond was slashed
        assert_eq!(w.identity.get_agent(w.provider_id).status, AgentStatus::Slashed);
        assert_eq!(w.identity.get_agent(w.provider_id).bond, U512::zero());
    }

    #[test]
    fn refund_rejects_before_deadline() {
        let mut w = setup();
        let deadline = w.env.block_time() + 1000;
        let id = fund_job(&mut w, 1000, deadline);

        w.env.set_caller(w.client_wallet);
        let result = w.escrow.try_refund(id);
        assert_eq!(result, Err(Error::DeadlineNotReached.into()));
    }

    #[test]
    fn claim_after_deadline_pays_unapproved_provider() {
        let mut w = setup();
        let deadline = w.env.block_time() + 1000;
        let id = fund_job(&mut w, 1000, deadline);
        w.env.set_caller(w.provider_wallet);
        w.escrow.submit_work(id, "ipfs://result".to_string());

        w.env.advance_block_time(2000);
        w.env.set_caller(w.provider_wallet);
        w.escrow.claim(id);

        let fee = 1000 * FEE_BPS / 10_000;
        assert_eq!(w.escrow.get_job(id).state, JobState::Released);
        assert_eq!(w.token.balance_of(&w.provider_wallet), U256::from(1000 - fee));
        assert_eq!(w.reputation.get_reputation(w.provider_id).jobs_completed, 1);
    }
}
