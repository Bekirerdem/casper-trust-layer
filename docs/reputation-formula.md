# ReputationEngine Formula — Grounded Design

> Source: a 6-agent parallel research sweep + 12 adversarial verification workflows (2026-06-15). All arithmetic is **unsigned-integer / basis-point (0..10000)**, **O(1) incremental**, gas-bounded.

> **MOST CRITICAL FINDING:** the naive `Δscore = amount × cp_weight × repeat_dampening` formula is **NOT enough** on its own. All 12 adversarial verifications converged on the same residual attack: **bought-edge / self-dealing reputation laundering** — the attacker acquires a single reputable/bonded agent `F` (or controls both sides itself), uses `F` as the client, and mints unbounded score onto the target; every job is a fresh pair, so repeat-dampening never triggers, and because cp_weight > 0 the Sybil zeroing never fires either. The **only mechanism that closes this is a per-edge lifetime contribution CAP + trust conservation** (an O(1) local projection of EigenTrust's max-flow + trust-mass-conservation properties).

## 1. The formula

### 1.1 Stored state (running aggregates, O(1))
For every **provider** (`agent_id: u32`):
- `score_bps: U256` — accumulated reputation (bps, decimals = 4)
- `jobs_completed: u64` — the ERC-8004 `count`
- `total_volume: U256` — analytics
- `distinct_clients: u32` — breadth signal
- `granted_out_bps: U256` — how much reputation this agent has conferred *as a client* (trust conservation)

For every **(provider, client_id) pair**: `PairStat { jobs: u32, contributed_bps: U256 }` (the existing `seen_client: bool` is promoted into this struct), `pairs: Mapping<(u32,u32), PairStat>`.

### 1.2 Δscore (on every settled job, single pass)
```
v_bps         = isqrt(amount_scaled)                      // (a) concave value
d             = isqrt(client_earned_score_bps)
cp_weight_bps =                                           // (b) saturating counterparty weight
    if d < T_MIN        -> 0                              //   sybil / zero-rep -> 0
    else if d >= T_SAT  -> 10000                          //   established -> full weight
    else  ((d - T_MIN) * 10000) / (T_SAT - T_MIN)
cp_weight_bps = max(cp_weight_bps, bond_floor_bps(client_id))   // cold start (§2.3)
k             = pair.jobs
damp_bps      = max(DAMP_FLOOR_BPS, 10000 / (1 + k))      // (c) repeat dampening, floored
raw_delta_bps = v_bps * cp_weight_bps / 10000 * damp_bps / 10000   // (d) multiply-before-divide
edge_cap_bps  = EDGE_CAP_BASE_bps + bond_to_cap(client_bond)       // (e) PER-EDGE LIFETIME CAP
delta_bps     = min(raw_delta_bps, edge_cap_bps.saturating_sub(pair.contributed_bps))
grantor_budget = client_earned_score_bps * GRANT_K_bps / 10000    // (f) TRUST CONSERVATION
delta_bps      = min(delta_bps, grantor_budget.saturating_sub(client.granted_out_bps))
```
Accumulation (O(1)): `provider.score_bps += delta; jobs_completed++; total_volume += amount; pair.jobs++; pair.contributed_bps += delta; client.granted_out_bps += delta; if pair.jobs==1 { distinct_clients++ }`.

## 2. Resolving the three tensions
- **SYBIL SWARM:** `cp_weight` is read from the client's **earned** score (NOT from distinct_clients or the bond). Zero rep → cp_weight = 0 → delta = 0. A swarm costs N × MIN_BOND in linear capital; parameters are tuned so cost-of-corruption > profit-from-corruption.
- **COLLUSION / WASH:** (1) the per-pair `damp = 10000/(1+k)` decays fast, (2) the per-edge `cap` bounds the lifetime total (also closing rotation/star patterns), (3) the escrow **protocol fee** (2%, permanently locked in the escrow contract) makes wash trading cost real value instead of just gas. **Legitimate repeat business is preserved:** dampening is per-pair, and a provider's score is built from the first jobs of many DISTINCT clients; breadth carries.
- **COLD START (the weight = 0 deadlock paradox):** `bond_floor_bps = if Active && bond >= MIN_BOND: min(BOND_FLOOR_CAP, bond*MAX_BP/(bond+K_BOND)) else 0`, and `cp_weight = max(earned, bond_floor)`. The bond does NOT open a hole because the floor is capped (< saturation — a full score can never be bought), gated (Active + bonded), excluded from the `granted_out` budget (trust cannot be minted onto Sybils), and read live (it collapses the moment the agent is slashed). The `max(floor, earned)` crossover gives a free fade-out — no decay state needed.

## 3. O(1) gas + a signature change (REQUIRED)
```rust
// OLD: client is a bare Address — no reputation to read, the formula cannot be evaluated
fn record_settlement(&mut self, provider: u32, client: Address, amount: U256)
// NEW: client is a registered agent_id — cp_weight + bond become readable
fn record_settlement(&mut self, provider: u32, client_id: u32, amount: U256)
```
The escrow `Job` carries a `client_id` (clients must also be registered/bonded agents). We do NOT replicate canonical ERC-8004's iterate-all-history `get_summary` anti-pattern — running aggregates stay incremental. Cost per settlement: 1 cross-contract read (client bond + earned score) + 1 pair read + fixed multiply/divide work (isqrt ≈ 8 iterations) + ~5 writes. **isqrt:** Babylonian/Newton on U256, bounded loop.

## 4. ERC-8004 get_summary mapping
```rust
pub fn get_summary(&self, agent_id: u32) -> (u64, U256, u8) {
    let r = self.rep_of(agent_id);
    (r.jobs_completed, r.score_bps, 4u8)   // count, summary_value (bps), decimals = 4
}
```
U256 unsigned instead of ERC-8004's signed `int128`. Failures are expressed through **slashing** (the bond floor collapses + status = Slashed), not negative scores. Objective settlement as the single write path closes ERC-8004's subjective-feedback hole.

## 5. Parameters (governance-tunable)
| Param | Initial | Role |
|---|---|---|
| `T_MIN` | 10 | Sybil floor (below it, cp_weight = 0) |
| `T_SAT` | 50 | Honest saturation (above it, full weight) |
| `DAMP_FLOOR_BPS` | 2000 (20%) | Repeat-dampening floor |
| `EDGE_CAP_BASE_bps` | 5000 | Per-pair lifetime contribution ceiling |
| `bond_to_cap` slope | +1 bps / CSPR above MIN | Edge cap ↔ client bond |
| `GRANT_K_bps` | 5000 (50%) | Trust-conservation ratio |
| `MAX_BP` (bond floor) | 5000 (< 10000!) | A bond can never buy a full score |
| `BOND_FLOOR_CAP` | 1000 (10%) | Newcomer-floor ceiling |
| `K_BOND` | ≈ 4× a typical job value | Bond-floor half-saturation |
| `FEE_BPS` (escrow protocol fee, locked) | 200 (2%) | Wash-trading cost |
| `MIN_BOND` | 10 CSPR | Per-identity Sybil cost |

**Most load-bearing:** `EDGE_CAP` + `GRANT_K` — calibrated via simulation/tests (not from the literature). Too loose → bought-edge comes back; too tight → legitimate high-volume pairs get throttled.

## 6. Test plan (OdraVM)
- **T1 sybil-swarm:** 50 zero-rep bonded agents pay P → `P.score_bps == 0`
- **T2 collusion-pair:** A↔B trade 100× → delta decreases monotonically, `pair.contributed <= edge_cap`
- **T3 star / bought-edge:** F → 20 sybil providers → `sum(Ti.score) <= F.earned * GRANT_K/10000` (the attack the naive formula fails)
- **T4 legit-repeat:** reputable C hires good P 50×, and P has 30 distinct clients → P stays positive; breadth carries
- **T5 cold-start:** fresh A, B (bonded, earned = 0), A → B → `B.score_bps > 0` but capped
- **T6 slash:** F starts a bought-edge run, a dispute slashes it → `cp_weight == 0`, no new delta can be produced
- **T7 get_summary:** returns `(jobs_completed, score_bps, 4)`, O(1)
- **T8 protocol-fee:** a wash ring loses a net `N*fee*V`

## 7. Accepted risks / deferrals in v1
1. **Single-hop only** (no transitive trust) — real multi-hop EigenTrust needs off-chain compute + zk, incompatible with O(1)/unsigned math. A deliberate trade.
2. **EDGE_CAP / GRANT_K calibration** needs simulation (a parameter sweep is mandatory before mainnet). Risk: medium.
3. **The slashing-oracle problem** — collusion cannot be proven on-chain without misclassifying legitimate high-frequency pairs; slashing exists only for escrow disputes, NOT for collusion. The primary defense is cap + conservation + fee.
4. **Build-then-betray / exit scam** — a single large-job payoff can exceed accumulated reputation + bond. v2 hardening (out of scope): job-proportional dynamic bond, milestone escrow, concurrency cap, time-locked reputation maturation.
5. **No decay** (v1) — `granted_out` grows monotonically; a lazy half-life right-shift (`score >> Δt/H`) is v2 hardening.
6. **Clients must be registered** (`client_id: u32`) — a Sybil cost, but UX friction (clients also post a bond).
7. **isqrt gas unmeasured** — low risk; OdraVM bench before deploy.

The next three findings come from an internal audit of the **frozen v1 contracts**. We document them rather than patch them: the deployed contracts are deliberately **not** redeployed before the buildathon deadline — a redeploy would reset the live reputation network — so the fixes are scoped to v2.

8. **Slash griefing (v1 accepted risk).** `create_job` (`contracts/src/escrow.rs`) requires no provider consent. If the deadline passes with no submission, `refund` slashes the provider's **entire** bond. A malicious client can therefore open a dust-amount, short-deadline job against any provider and grief-slash it. v2 fix: an `accept_job` step (explicit provider consent) before funds lock, and/or a slash proportional to the job amount.
9. **A non-existent provider id locks client funds.** `create_job` does not verify that the provider identity exists. A job funded against an unregistered id can never be refunded — `refund` reverts inside `identity.slash` (`AgentNotFound`) — so the client's tokens stay locked in the escrow. v2 fix: an `agent_exists` check at job creation.
10. **Slashed agents retain their score.** `slash` zeroes the bond and sets `status = Slashed`, but leaves `score_bps` untouched. The SDK's `checkTrust` correctly requires `Active` status, but AgentTreasury's **on-chain** gate checks only the score — so a slashed agent still passes the treasury reputation gate. v2 fix: the treasury gate also checks registry status.

## Affected files
- `reputation.rs` — formula + state (score_bps / granted_out_bps / PairStat) + isqrt + cross-contract bond read + get_summary; signature change `client: Address` → `client_id: u32`
- `escrow.rs` — `Job.client_id`; `settle()` retains the `FEE_BPS` fee permanently locked in the escrow contract; the `record_settlement` call carries the client_id
- `identity.rs` — `AgentStatus::Slashed` set from the escrow dispute path + bond seizure; `Agent.bond` read live cross-contract
