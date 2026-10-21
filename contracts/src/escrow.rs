use crate::identity::IdentityRegistryContractRef;
use crate::reputation::ReputationEngineContractRef;
use odra::casper_types::U256;
use odra::prelude::*;
use odra::ContractRef;
use odra_modules::cep18_token::Cep18ContractRef;

/// Protocol fee on settlement (basis points). Makes wash-trading lose value on
/// every hop even though the round-trip capital returns. The fee is retained in
/// the escrow's fee bucket (`fees`) and only the admin can move it out — it is
/// not burned.
const FEE_BPS: u64 = 200; // 2%

/// Shortest allowed job (Unix ms from creation to deadline). A zero or
/// near-zero deadline was the griefing vector: fund, wait one block, slash.
pub const MIN_WINDOW_MS: u64 = 10 * 60_000; // 10 minutes
/// Longest allowed job, so funds and bonds cannot be tied up indefinitely.
pub const MAX_WINDOW_MS: u64 = 30 * 86_400_000; // 30 days
/// After a submission the client has at least this long to approve or dispute
/// before the provider may claim on its own.
pub const DISPUTE_WINDOW_MS: u64 = 86_400_000; // 24 hours
/// Upper bound on the deliverable fingerprint.
pub const MAX_RESULT_LEN: usize = 256;

/// Lifecycle of an escrowed job. The settled (`Released`) transition is the
/// objective, payment-backed signal the ReputationEngine derives scores from.
///
/// Funded → Accepted → Submitted → Released | Disputed
/// Funded → Cancelled (provider never accepted; no slash)
/// Accepted → Refunded (deadline passed with no submission; provider slashed)
///
/// v2 variants are appended so the v1 tags (0..=3) keep their meaning off-chain.
#[odra::odra_type]
pub enum JobState {
    Funded,
    Submitted,
    Released,
    Refunded,
    Accepted,
    Cancelled,
    Disputed,
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
    /// When the work was submitted (Unix ms), 0 before. Starts the dispute window.
    pub submitted_at: u64,
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
    /// Deadline is closer than `MIN_WINDOW_MS` or further than `MAX_WINDOW_MS`.
    InvalidDeadline = 9,
    /// The client or provider identity is missing, slashed, withdrawn or unbonding.
    AgentNotActive = 10,
    /// The dispute window is still open; the provider cannot claim yet.
    DisputeWindowOpen = 11,
    /// The dispute window has closed.
    DisputeWindowClosed = 12,
    NotAdmin = 13,
    NotPendingAdmin = 14,
    /// New jobs are halted; settlement of existing jobs still works.
    Paused = 15,
    /// The deliverable fingerprint is longer than `MAX_RESULT_LEN`.
    ResultTooLong = 16,
    /// More than the fee bucket holds.
    InsufficientFees = 17,
}

/// Escrow that locks a client agent's CEP-18 funds against a provider agent's
/// work. The provider must accept a job before its bond is at stake. On
/// settlement it pays the provider's wallet (resolved from the IdentityRegistry),
/// keeps a fee, and reports the settlement to the ReputationEngine. On a deadline
/// default it refunds the client and slashes a share of the provider's bond to
/// the client.
#[allow(dead_code)]
#[odra::module(
    errors = Error,
    events = [
        JobCreated, WorkSubmitted, JobReleased, JobRefunded,
        JobAccepted, JobCancelled, JobDisputed, PauseChanged, FeesWithdrawn,
        AdminTransferStarted, AdminChanged
    ]
)]
pub struct Escrow {
    identity: Var<Address>,
    reputation: Var<Address>,
    token: Var<Address>,
    jobs: Mapping<u64, Job>,
    count: Var<u64>,
    // ---- v2 — appended so earlier storage indices stay valid off-chain ----
    admin: Var<Address>,
    pending_admin: Var<Option<Address>>,
    paused: Var<bool>,
    /// Fees retained from settlements, withdrawable by the admin.
    fees: Var<U256>,
}

#[odra::module]
impl Escrow {
    pub fn init(&mut self, identity: Address, reputation: Address, token: Address) {
        self.identity.set(identity);
        self.reputation.set(reputation);
        self.token.set(token);
        self.admin.set(self.env().caller());
    }

    /// Client agent creates and funds a job hiring `provider`. Caller must be the
    /// client's operational wallet; it must have approved the escrow for `amount`.
    /// Both identities must be active and the deadline (Unix ms) must sit between
    /// `MIN_WINDOW_MS` and `MAX_WINDOW_MS` from now. Nothing is at stake for the
    /// provider until it calls `accept_job`.
    pub fn create_job(&mut self, client_id: u32, provider: u32, amount: U256, deadline: u64) -> u64 {
        self.not_paused();
        if amount.is_zero() {
            self.env().revert(Error::ZeroAmount);
        }
        if provider == client_id {
            self.env().revert(Error::SelfHire);
        }
        let identity = self.identity_ref();
        if !identity.is_active(client_id) || !identity.is_active(provider) {
            self.env().revert(Error::AgentNotActive);
        }
        let caller = self.env().caller();
        if caller != self.agent_wallet(client_id) {
            self.env().revert(Error::NotClient);
        }
        let now = self.env().get_block_time();
        if deadline < now + MIN_WINDOW_MS || deadline > now + MAX_WINDOW_MS {
            self.env().revert(Error::InvalidDeadline);
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
                submitted_at: 0,
            },
        );
        self.count.set(id + 1);

        self.token_ref()
            .transfer_from(&caller, &self.env().self_address(), &amount);

        self.env().emit_event(JobCreated { job_id: id, client_id, provider, amount });
        id
    }

    /// Provider agent takes the job (from its wallet). From here on its bond is
    /// locked and a missed deadline slashes it.
    pub fn accept_job(&mut self, job_id: u64) {
        self.not_paused();
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
        if !self.identity_ref().is_active(job.provider) {
            self.env().revert(Error::AgentNotActive);
        }
        let provider = job.provider;
        job.state = JobState::Accepted;
        self.jobs.set(&job_id, job);
        self.identity_ref().job_opened(provider);
        self.env().emit_event(JobAccepted { job_id, provider });
    }

    /// Client withdraws a job the provider has not accepted yet: full refund, no
    /// slash, no fee. Any time before acceptance.
    pub fn cancel_job(&mut self, job_id: u64) {
        let mut job = self.load(job_id);
        let client_wallet = self.agent_wallet(job.client_id);
        if self.env().caller() != client_wallet {
            self.env().revert(Error::NotClient);
        }
        if job.state != JobState::Funded {
            self.env().revert(Error::InvalidState);
        }
        let (client_id, amount) = (job.client_id, job.amount);
        job.state = JobState::Cancelled;
        self.jobs.set(&job_id, job);
        self.token_ref().transfer(&client_wallet, &amount);
        self.env().emit_event(JobCancelled { job_id, client_id, amount });
    }

    /// Provider agent submits the deliverable hash (from its wallet). Before deadline.
    pub fn submit_work(&mut self, job_id: u64, result_hash: String) {
        if result_hash.len() > MAX_RESULT_LEN {
            self.env().revert(Error::ResultTooLong);
        }
        let mut job = self.load(job_id);
        if self.env().caller() != self.agent_wallet(job.provider) {
            self.env().revert(Error::NotProvider);
        }
        if job.state != JobState::Accepted {
            self.env().revert(Error::InvalidState);
        }
        let now = self.env().get_block_time();
        if now >= job.deadline {
            self.env().revert(Error::DeadlinePassed);
        }
        job.result_hash = result_hash;
        job.state = JobState::Submitted;
        job.submitted_at = now;
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
        self.identity_ref().job_closed(provider);
        self.settle(job_id, client_id, provider, amount);
    }

    /// Client rejects a submission while the dispute window is open. v2 minimal
    /// dispute: the client gets the amount back minus the protocol fee (so a
    /// dispute is never free), the provider gets no reputation and no slash.
    /// A real arbiter is future work — see docs/reputation-formula.md §7.
    pub fn dispute(&mut self, job_id: u64) {
        let mut job = self.load(job_id);
        let client_wallet = self.agent_wallet(job.client_id);
        if self.env().caller() != client_wallet {
            self.env().revert(Error::NotClient);
        }
        if job.state != JobState::Submitted {
            self.env().revert(Error::InvalidState);
        }
        if self.env().get_block_time() >= Self::claimable_at(&job) {
            self.env().revert(Error::DisputeWindowClosed);
        }
        let (client_id, provider, amount) = (job.client_id, job.provider, job.amount);
        job.state = JobState::Disputed;
        self.jobs.set(&job_id, job);
        self.identity_ref().job_closed(provider);

        let fee = Self::fee_of(amount);
        self.fees.set(self.fees.get_or_default() + fee);
        let refund = amount - fee;
        self.token_ref().transfer(&client_wallet, &refund);
        self.env().emit_event(JobDisputed { job_id, client_id, provider, refund });
    }

    /// After the deadline with no submission, the client reclaims the funds and a
    /// share of the defaulting provider's bond is slashed to the client wallet.
    /// Only for accepted jobs — an unaccepted job is cancelled, never slashed.
    pub fn refund(&mut self, job_id: u64) {
        let mut job = self.load(job_id);
        let client_wallet = self.agent_wallet(job.client_id);
        if self.env().caller() != client_wallet {
            self.env().revert(Error::NotClient);
        }
        if job.state != JobState::Accepted {
            self.env().revert(Error::InvalidState);
        }
        if self.env().get_block_time() < job.deadline {
            self.env().revert(Error::DeadlineNotReached);
        }
        let (client_id, provider, amount) = (job.client_id, job.provider, job.amount);
        job.state = JobState::Refunded;
        self.jobs.set(&job_id, job);

        self.token_ref().transfer(&client_wallet, &amount);
        let mut identity = self.identity_ref();
        identity.job_closed(provider);
        identity.slash(provider, client_wallet);
        self.env().emit_event(JobRefunded { job_id, client_id, amount });
    }

    /// Once the deadline and the dispute window have both passed, a provider that
    /// submitted but was never approved can claim payment (protects the provider
    /// from an unresponsive client).
    pub fn claim(&mut self, job_id: u64) {
        let mut job = self.load(job_id);
        if self.env().caller() != self.agent_wallet(job.provider) {
            self.env().revert(Error::NotProvider);
        }
        if job.state != JobState::Submitted {
            self.env().revert(Error::InvalidState);
        }
        if self.env().get_block_time() < Self::claimable_at(&job) {
            self.env().revert(Error::DisputeWindowOpen);
        }
        let (client_id, provider, amount) = (job.client_id, job.provider, job.amount);
        job.state = JobState::Released;
        self.jobs.set(&job_id, job);
        self.identity_ref().job_closed(provider);
        self.settle(job_id, client_id, provider, amount);
    }

    // ---- admin -------------------------------------------------------------------

    /// Halts new jobs and new acceptances. Every settlement path (submit, approve,
    /// dispute, refund, claim, cancel) keeps working so no funds can be trapped.
    pub fn pause(&mut self) {
        self.only_admin();
        self.paused.set(true);
        self.env().emit_event(PauseChanged { paused: true });
    }

    pub fn unpause(&mut self) {
        self.only_admin();
        self.paused.set(false);
        self.env().emit_event(PauseChanged { paused: false });
    }

    /// Moves retained fees out of the escrow. Admin only.
    pub fn withdraw_fees(&mut self, to: Address, amount: U256) {
        self.only_admin();
        let fees = self.fees.get_or_default();
        if amount > fees {
            self.env().revert(Error::InsufficientFees);
        }
        self.fees.set(fees - amount);
        self.token_ref().transfer(&to, &amount);
        self.env().emit_event(FeesWithdrawn { to, amount });
    }

    /// Starts a two-step admin handover; `to` must call `accept_admin`.
    pub fn transfer_admin(&mut self, to: Address) {
        self.only_admin();
        self.pending_admin.set(Some(to));
        self.env().emit_event(AdminTransferStarted { to });
    }

    pub fn accept_admin(&mut self) {
        let caller = self.env().caller();
        if self.pending_admin.get().flatten() != Some(caller) {
            self.env().revert(Error::NotPendingAdmin);
        }
        self.admin.set(caller);
        self.pending_admin.set(None);
        self.env().emit_event(AdminChanged { admin: caller });
    }

    // ---- views ----------------------------------------------------------------

    pub fn get_job(&self, job_id: u64) -> Job {
        self.load(job_id)
    }

    pub fn total_jobs(&self) -> u64 {
        self.count.get_or_default()
    }

    pub fn fees(&self) -> U256 {
        self.fees.get_or_default()
    }

    pub fn is_paused(&self) -> bool {
        self.paused.get_or_default()
    }

    pub fn admin(&self) -> Address {
        self.admin.get().unwrap_or_revert(self)
    }

    // ---- internal -------------------------------------------------------------

    /// Pays the provider (net of fee), retains the fee, and reports the gross
    /// settlement to the ReputationEngine.
    fn settle(&mut self, job_id: u64, client_id: u32, provider: u32, amount: U256) {
        let fee = Self::fee_of(amount);
        let payout = amount - fee;
        self.fees.set(self.fees.get_or_default() + fee);
        let wallet = self.agent_wallet(provider);
        self.token_ref().transfer(&wallet, &payout);
        self.reputation_ref().record_settlement(provider, client_id, amount);
        self.env().emit_event(JobReleased { job_id, client_id, provider, amount });
    }

    fn fee_of(amount: U256) -> U256 {
        amount * U256::from(FEE_BPS) / U256::from(10_000u64)
    }

    /// The provider may claim from here on; the client may dispute until then.
    fn claimable_at(job: &Job) -> u64 {
        job.deadline.max(job.submitted_at + DISPUTE_WINDOW_MS)
    }

    fn only_admin(&self) {
        if self.env().caller() != self.admin.get().unwrap_or_revert(self) {
            self.env().revert(Error::NotAdmin);
        }
    }

    fn not_paused(&self) {
        if self.paused.get_or_default() {
            self.env().revert(Error::Paused);
        }
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

/// Emitted when funds are refunded to the client after a provider default.
#[odra::event]
pub struct JobRefunded {
    pub job_id: u64,
    pub client_id: u32,
    pub amount: U256,
}

/// Emitted when the provider accepts a job.
#[odra::event]
pub struct JobAccepted {
    pub job_id: u64,
    pub provider: u32,
}

/// Emitted when the client cancels an unaccepted job.
#[odra::event]
pub struct JobCancelled {
    pub job_id: u64,
    pub client_id: u32,
    pub amount: U256,
}

/// Emitted when the client disputes a submission.
#[odra::event]
pub struct JobDisputed {
    pub job_id: u64,
    pub client_id: u32,
    pub provider: u32,
    pub refund: U256,
}

#[odra::event]
pub struct PauseChanged {
    pub paused: bool,
}

#[odra::event]
pub struct FeesWithdrawn {
    pub to: Address,
    pub amount: U256,
}

#[odra::event]
pub struct AdminTransferStarted {
    pub to: Address,
}

#[odra::event]
pub struct AdminChanged {
    pub admin: Address,
}

#[cfg(test)]
mod tests {
    use super::{
        Error, Escrow, EscrowHostRef, EscrowInitArgs, JobReleased, JobState, DISPUTE_WINDOW_MS,
        FEE_BPS, MAX_RESULT_LEN, MAX_WINDOW_MS, MIN_WINDOW_MS,
    };
    use crate::identity::{
        AgentStatus, IdentityRegistry, IdentityRegistryHostRef, MIN_BOND, SLASH_BPS,
        UNBONDING_DELAY_MS,
    };
    use crate::reputation::{ReputationEngine, ReputationEngineHostRef, ReputationEngineInitArgs};
    use odra::casper_types::{U256, U512};
    use odra::host::{Deployer, HostEnv, HostRef, NoArgs};
    use odra::prelude::{Address, Addressable};
    use odra_modules::cep18_token::{Cep18, Cep18HostRef, Cep18InitArgs};

    const SUPPLY: u64 = 1_000_000;
    const HOUR: u64 = 3_600_000;

    struct World {
        env: HostEnv,
        identity: IdentityRegistryHostRef,
        reputation: ReputationEngineHostRef,
        token: Cep18HostRef,
        escrow: EscrowHostRef,
        admin: Address,
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
        // Test jobs settle 1000 base units; keep the dust floor below that.
        reputation.set_min_job_amount(U256::from(100u64));

        // Register the two agents.
        env.set_caller(client_wallet);
        let client_id = register(&mut identity, "ipfs://client");
        env.set_caller(provider_wallet);
        let provider_id = register(&mut identity, "ipfs://provider");

        World { env, identity, reputation, token, escrow, admin, client_wallet, provider_wallet, client_id, provider_id }
    }

    fn fund_job(w: &mut World, amount: u64, deadline: u64) -> u64 {
        w.env.set_caller(w.client_wallet);
        w.token.approve(&w.escrow.address(), &U256::from(amount));
        w.escrow.create_job(w.client_id, w.provider_id, U256::from(amount), deadline)
    }

    /// Funds a job one hour out and has the provider accept it.
    fn accepted_job(w: &mut World, amount: u64) -> u64 {
        let deadline = w.env.block_time() + HOUR;
        let id = fund_job(w, amount, deadline);
        w.env.set_caller(w.provider_wallet);
        w.escrow.accept_job(id);
        id
    }

    fn submitted_job(w: &mut World, amount: u64) -> u64 {
        let id = accepted_job(w, amount);
        w.env.set_caller(w.provider_wallet);
        w.escrow.submit_work(id, "ipfs://result".to_string());
        id
    }

    #[test]
    fn create_job_locks_funds_and_sets_funded() {
        let mut w = setup();
        let deadline = w.env.block_time() + HOUR;

        let id = fund_job(&mut w, 1000, deadline);

        let job = w.escrow.get_job(id);
        assert_eq!(job.client_id, w.client_id);
        assert_eq!(job.provider, w.provider_id);
        assert_eq!(job.state, JobState::Funded);
        assert_eq!(w.token.balance_of(&w.escrow.address()), U256::from(1000u64));
        assert_eq!(w.token.balance_of(&w.client_wallet), U256::from(SUPPLY - 1000));
        // Not accepted yet: the provider's bond is not locked.
        assert_eq!(w.identity.open_jobs(w.provider_id), 0);
    }

    #[test]
    fn cannot_hire_self() {
        let mut w = setup();
        w.env.set_caller(w.client_wallet);
        w.token.approve(&w.escrow.address(), &U256::from(1000u64));
        let result = w.escrow.try_create_job(w.client_id, w.client_id, U256::from(1000u64), w.env.block_time() + HOUR);
        assert_eq!(result, Err(Error::SelfHire.into()));
    }

    #[test]
    fn full_loop_pays_provider_keeps_fee_and_updates_reputation() {
        let mut w = setup();
        let id = submitted_job(&mut w, 1000);
        w.env.set_caller(w.client_wallet);
        w.escrow.approve(id);

        let fee = 1000 * FEE_BPS / 10_000; // 20
        assert_eq!(w.escrow.get_job(id).state, JobState::Released);
        assert_eq!(w.token.balance_of(&w.provider_wallet), U256::from(1000 - fee)); // net of fee
        assert_eq!(w.token.balance_of(&w.escrow.address()), U256::from(fee)); // fee retained
        assert_eq!(w.escrow.fees(), U256::from(fee)); // ...and accounted
        assert_eq!(w.identity.open_jobs(w.provider_id), 0); // bond unlocked again
        let rep = w.reputation.get_reputation(w.provider_id);
        assert_eq!(rep.jobs_completed, 1);
        assert!(rep.score_bps > U256::zero()); // bonded client confers bootstrap reputation
    }

    #[test]
    fn approve_emits_job_released_event() {
        let mut w = setup();
        let id = submitted_job(&mut w, 1000);
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
        let id = accepted_job(&mut w, 1000);

        w.env.set_caller(w.client_wallet);
        let result = w.escrow.try_submit_work(id, "ipfs://x".to_string());
        assert_eq!(result, Err(Error::NotProvider.into()));
    }

    #[test]
    fn submit_work_needs_acceptance_first() {
        let mut w = setup();
        let deadline = w.env.block_time() + HOUR;
        let id = fund_job(&mut w, 1000, deadline);

        w.env.set_caller(w.provider_wallet);
        let result = w.escrow.try_submit_work(id, "ipfs://x".to_string());
        assert_eq!(result, Err(Error::InvalidState.into()));
    }

    #[test]
    fn submit_work_rejects_oversized_result() {
        let mut w = setup();
        let id = accepted_job(&mut w, 1000);
        w.env.set_caller(w.provider_wallet);
        let result = w.escrow.try_submit_work(id, "x".repeat(MAX_RESULT_LEN + 1));
        assert_eq!(result, Err(Error::ResultTooLong.into()));
    }

    #[test]
    fn refund_after_deadline_returns_funds_and_slashes_provider_to_client() {
        let mut w = setup();
        let id = accepted_job(&mut w, 1000);
        let client_cspr_before = w.env.balance_of(&w.client_wallet);

        w.env.advance_block_time(2 * HOUR);
        w.env.set_caller(w.client_wallet);
        w.escrow.refund(id);

        assert_eq!(w.escrow.get_job(id).state, JobState::Refunded);
        assert_eq!(w.token.balance_of(&w.client_wallet), U256::from(SUPPLY)); // full refund
        let seized = U512::from(MIN_BOND) * U512::from(SLASH_BPS) / U512::from(10_000u64);
        let provider = w.identity.get_agent(w.provider_id);
        assert_eq!(provider.status, AgentStatus::Slashed);
        assert_eq!(provider.bond, U512::from(MIN_BOND) - seized);
        // The seized share reached the client (it paid no gas in the test VM).
        assert_eq!(w.env.balance_of(&w.client_wallet), client_cspr_before + seized);
        assert_eq!(w.identity.open_jobs(w.provider_id), 0);
    }

    #[test]
    fn refund_rejects_before_deadline() {
        let mut w = setup();
        let id = accepted_job(&mut w, 1000);

        w.env.set_caller(w.client_wallet);
        let result = w.escrow.try_refund(id);
        assert_eq!(result, Err(Error::DeadlineNotReached.into()));
    }

    #[test]
    fn claim_after_deadline_and_dispute_window_pays_unapproved_provider() {
        let mut w = setup();
        let id = submitted_job(&mut w, 1000);

        // Past the deadline but inside the dispute window: not yet.
        w.env.advance_block_time(2 * HOUR);
        w.env.set_caller(w.provider_wallet);
        assert_eq!(w.escrow.try_claim(id), Err(Error::DisputeWindowOpen.into()));

        w.env.advance_block_time(DISPUTE_WINDOW_MS);
        w.escrow.claim(id);

        let fee = 1000 * FEE_BPS / 10_000;
        assert_eq!(w.escrow.get_job(id).state, JobState::Released);
        assert_eq!(w.token.balance_of(&w.provider_wallet), U256::from(1000 - fee));
        assert_eq!(w.reputation.get_reputation(w.provider_id).jobs_completed, 1);
    }

    // ---- attacks from the v1 audit --------------------------------------------

    /// B1 — fund a job with a zero / instant deadline, then refund to slash the
    /// victim. Rejected at creation; and without acceptance there is no slash.
    #[test]
    fn deadline_zero_griefing_is_rejected() {
        let mut w = setup();
        w.env.set_caller(w.client_wallet);
        w.token.approve(&w.escrow.address(), &U256::from(1000u64));
        let now = w.env.block_time();
        for deadline in [0, now, now + MIN_WINDOW_MS - 1, now + MAX_WINDOW_MS + 1] {
            let r = w.escrow.try_create_job(w.client_id, w.provider_id, U256::from(1000u64), deadline);
            assert_eq!(r, Err(Error::InvalidDeadline.into()));
        }
    }

    #[test]
    fn unaccepted_job_can_never_slash_the_provider() {
        let mut w = setup();
        let deadline = w.env.block_time() + MIN_WINDOW_MS;
        let id = fund_job(&mut w, 1000, deadline);

        w.env.advance_block_time(2 * HOUR);
        w.env.set_caller(w.client_wallet);
        assert_eq!(w.escrow.try_refund(id), Err(Error::InvalidState.into()));

        // The client takes the money back with cancel instead — no slash.
        w.escrow.cancel_job(id);
        assert_eq!(w.escrow.get_job(id).state, JobState::Cancelled);
        assert_eq!(w.token.balance_of(&w.client_wallet), U256::from(SUPPLY));
        assert_eq!(w.identity.get_agent(w.provider_id).status, AgentStatus::Active);
        assert_eq!(w.identity.get_agent(w.provider_id).bond, U512::from(MIN_BOND));
    }

    #[test]
    fn cancel_is_impossible_once_accepted() {
        let mut w = setup();
        let id = accepted_job(&mut w, 1000);
        w.env.set_caller(w.client_wallet);
        assert_eq!(w.escrow.try_cancel_job(id), Err(Error::InvalidState.into()));
    }

    /// B9 — hiring a provider id that does not exist used to lock funds forever
    /// (refund's slash reverted). Now it is rejected up front.
    #[test]
    fn nonexistent_provider_is_rejected() {
        let mut w = setup();
        w.env.set_caller(w.client_wallet);
        w.token.approve(&w.escrow.address(), &U256::from(1000u64));
        let r = w.escrow.try_create_job(w.client_id, 77, U256::from(1000u64), w.env.block_time() + HOUR);
        assert_eq!(r, Err(Error::AgentNotActive.into()));
    }

    /// B4/B10 — slashed, withdrawn or unbonding identities cannot be hired.
    #[test]
    fn inactive_provider_cannot_be_hired_or_accept() {
        let mut w = setup();
        let deadline = w.env.block_time() + HOUR;
        let id = fund_job(&mut w, 1000, deadline);

        // Provider starts unbonding after the job was posted but before accepting.
        w.env.set_caller(w.provider_wallet);
        w.identity.request_withdraw(w.provider_id);
        assert_eq!(w.escrow.try_accept_job(id), Err(Error::AgentNotActive.into()));

        w.env.set_caller(w.client_wallet);
        w.token.approve(&w.escrow.address(), &U256::from(1000u64));
        let r = w.escrow.try_create_job(w.client_id, w.provider_id, U256::from(1000u64), deadline);
        assert_eq!(r, Err(Error::AgentNotActive.into()));
    }

    /// B10 — a provider cannot pull its bond out from under an accepted job.
    #[test]
    fn provider_cannot_unbond_with_an_open_job() {
        let mut w = setup();
        accepted_job(&mut w, 1000);
        w.env.set_caller(w.provider_wallet);
        assert_eq!(
            w.identity.try_request_withdraw(w.provider_id),
            Err(crate::identity::Error::OpenJobs.into())
        );
    }

    /// B5 — junk submission at the last minute. The client disputes; the provider
    /// gets nothing and no reputation; the client gets the amount minus the fee.
    #[test]
    fn junk_submission_can_be_disputed() {
        let mut w = setup();
        let id = submitted_job(&mut w, 1000);

        w.env.advance_block_time(2 * HOUR); // past the deadline, inside the window
        w.env.set_caller(w.client_wallet);
        w.escrow.dispute(id);

        let fee = 1000 * FEE_BPS / 10_000;
        assert_eq!(w.escrow.get_job(id).state, JobState::Disputed);
        assert_eq!(w.token.balance_of(&w.client_wallet), U256::from(SUPPLY - fee));
        assert_eq!(w.token.balance_of(&w.provider_wallet), U256::zero());
        assert_eq!(w.reputation.get_reputation(w.provider_id).jobs_completed, 0);
        assert_eq!(w.identity.get_agent(w.provider_id).status, AgentStatus::Active); // no slash
        assert_eq!(w.identity.open_jobs(w.provider_id), 0);

        // Nothing left to claim.
        w.env.advance_block_time(DISPUTE_WINDOW_MS);
        w.env.set_caller(w.provider_wallet);
        assert_eq!(w.escrow.try_claim(id), Err(Error::InvalidState.into()));
    }

    #[test]
    fn dispute_closes_with_the_window() {
        let mut w = setup();
        let id = submitted_job(&mut w, 1000);
        w.env.advance_block_time(HOUR + DISPUTE_WINDOW_MS);
        w.env.set_caller(w.client_wallet);
        assert_eq!(w.escrow.try_dispute(id), Err(Error::DisputeWindowClosed.into()));
    }

    #[test]
    fn pause_stops_new_jobs_but_not_settlement() {
        let mut w = setup();
        let id = submitted_job(&mut w, 1000);
        w.env.set_caller(w.admin);
        w.escrow.pause();

        w.env.set_caller(w.client_wallet);
        w.token.approve(&w.escrow.address(), &U256::from(1000u64));
        let r = w.escrow.try_create_job(w.client_id, w.provider_id, U256::from(1000u64), w.env.block_time() + HOUR);
        assert_eq!(r, Err(Error::Paused.into()));

        // In-flight work still settles.
        w.escrow.approve(id);
        assert_eq!(w.escrow.get_job(id).state, JobState::Released);
    }

    #[test]
    fn admin_can_withdraw_fees_and_hand_over() {
        let mut w = setup();
        let id = submitted_job(&mut w, 1000);
        w.env.set_caller(w.client_wallet);
        w.escrow.approve(id);
        let fee = U256::from(1000 * FEE_BPS / 10_000);
        let treasury = w.env.get_account(7);

        w.env.set_caller(w.client_wallet);
        assert_eq!(w.escrow.try_withdraw_fees(treasury, fee), Err(Error::NotAdmin.into()));

        w.env.set_caller(w.admin);
        assert_eq!(
            w.escrow.try_withdraw_fees(treasury, fee + U256::one()),
            Err(Error::InsufficientFees.into())
        );
        w.escrow.withdraw_fees(treasury, fee);
        assert_eq!(w.token.balance_of(&treasury), fee);
        assert_eq!(w.escrow.fees(), U256::zero());

        let next = w.env.get_account(6);
        w.escrow.transfer_admin(next);
        w.env.set_caller(next);
        w.escrow.accept_admin();
        assert_eq!(w.escrow.admin(), next);
    }

    #[test]
    fn unbonding_completes_after_the_job_is_settled() {
        let mut w = setup();
        let id = submitted_job(&mut w, 1000);
        w.env.set_caller(w.client_wallet);
        w.escrow.approve(id);

        w.env.set_caller(w.provider_wallet);
        w.identity.request_withdraw(w.provider_id);
        w.env.advance_block_time(UNBONDING_DELAY_MS);
        w.identity.withdraw(w.provider_id);
        assert_eq!(w.identity.get_agent(w.provider_id).status, AgentStatus::Withdrawn);
    }
}
