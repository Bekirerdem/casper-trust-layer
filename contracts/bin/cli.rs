//! Deploy + interact CLI for the Casper Agent Trust Layer (via odra-cli / livenet).
//!
//! Deploy:  cargo run --bin contracts_cli -- deploy
//! (reads .env: ODRA_CASPER_LIVENET_NODE_ADDRESS / _CHAIN_NAME / _SECRET_KEY_PATH)

use contracts::escrow::{Escrow, EscrowInitArgs};
use contracts::identity::IdentityRegistry;
use contracts::reputation::{ReputationEngine, ReputationEngineInitArgs};
use contracts::treasury::{AgentTreasury, AgentTreasuryInitArgs};
use odra::casper_types::U256;
use odra::host::{HostEnv, NoArgs};
use odra::prelude::Addressable;
use odra_cli::{deploy::DeployScript, DeployedContractsContainer, DeployerExt, OdraCli};
use odra_modules::cep18_token::{Cep18, Cep18InitArgs};

/// Deploys the four contracts of the trust layer and wires them together.
pub struct TrustLayerDeployScript;

impl DeployScript for TrustLayerDeployScript {
    fn deploy(
        &self,
        env: &HostEnv,
        container: &mut DeployedContractsContainer,
    ) -> Result<(), odra_cli::deploy::Error> {
        let gas = 400_000_000_000u64; // ~400 CSPR per deploy

        // Identity registry (no init args).
        let mut identity = IdentityRegistry::load_or_deploy(env, NoArgs, container, gas)?;

        // Reputation engine reads bond/status from the identity registry.
        let mut reputation = ReputationEngine::load_or_deploy(
            env,
            ReputationEngineInitArgs { identity: identity.address() },
            container,
            gas,
        )?;

        // A demo CEP-18 payment token; the deployer holds the initial supply.
        let token = Cep18::load_or_deploy(
            env,
            Cep18InitArgs {
                symbol: "AGT".to_string(),
                name: "Agent Credits".to_string(),
                decimals: 9,
                initial_supply: U256::from(1_000_000_000_000_000u64),
            },
            container,
            gas,
        )?;

        // Escrow ties identity (wallet resolution + slash), reputation, and token.
        let escrow = Escrow::load_or_deploy(
            env,
            EscrowInitArgs {
                identity: identity.address(),
                reputation: reputation.address(),
                token: token.address(),
            },
            container,
            gas,
        )?;

        // Wire the escrow address into both contracts (one-time).
        env.set_gas(20_000_000_000u64);
        identity.set_escrow(escrow.address());
        env.set_gas(20_000_000_000u64);
        reputation.set_escrow(escrow.address());

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

        Ok(())
    }
}

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
