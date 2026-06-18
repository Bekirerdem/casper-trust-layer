# Off-chain SDK Research — Casper Trust Layer

> 3-agent parallel research (2026-06-18). Read-path + write-path **verified live against `casper-test`**.
> Anchors the implementation plan. Two findings change the plan — see §0.

## §0. Two plan-changing findings

1. **Read path = storage-decode, NOT entrypoint-call (verified live).** Casper has no `eth_call`/
   free view invocation; every `&self` view is only callable via a paid tx. The wallet-free read
   works by reading the Odra `state` dictionary over RPC and decoding the bytes client-side
   (exactly what Odra's `livenet` backend does). Proven: all 3 contracts were read live, zero gas,
   and their on-chain cross-contract wiring decoded correctly. **Architecture stands; mechanism differs.**

2. **🔴 An official x402 TS client ALREADY EXISTS: `@make-software/casper-x402`.** Working client
   (`x402Client` + `ExactCasperScheme` + `createClientCasperSigner`), e2e example, Go facilitator,
   Express demos. The spec's §1/§2 "no x402 client exists, every name 404s, own the gap" insight is
   **outdated**. This invalidates the `casper-x402` package-name decision and the "owns the default
   import" wedge. The genuinely empty space is **trust** (cred402/credmesh are on Base, not Casper).
   → strategic re-positioning needed before the plan is written.

---

## §1. Read path (wallet-free, gas-free) — VERIFIED LIVE

**Mechanism:** `query_global_state(hash-<pkg>)` → current `contract_hash` → `Contract.named_keys` →
`state` URef → `state_get_dictionary_item(odra_item_key)` → strip 4-byte LE prefix → bytesrepr-decode
→ recompute the view formula in TS. These contracts use the **legacy Contract/ContractPackage model**
(NOT the Condor AddressableEntity model) — resolve via `hash-<pkg>` (the `contract-package-` prefix is
rejected by the node).

**SDK:** `casper-js-sdk@5.0.12` (latest). v5 is a rewrite — the `CLValueBuilder`/`CasperServiceByJsonRPC`
API in old tutorials is **v2 and wrong**. Use `RpcClient` + `HttpHandler` + `ParamDictionaryIdentifier`.
CSPR.cloud: `new HttpHandler("https://node.testnet.cspr.cloud/rpc")` + `handler.setCustomHeaders({ Authorization: <UUID> })`.

**Odra storage layout (source-of-truth odra 2.8):**
- All module state lives in ONE dictionary named `state`.
- Dictionary item key = `hex( blake2b_256( index_bytes ++ mapping_key_bytes ) )` (64-char hex).
  - `index_bytes` = u32 **big-endian** of the field's 0-based declaration index (for index ≤ 15;
    16+ or submodule-nested uses `[0xFF, path_len, idx...]`).
  - `mapping_key_bytes` = Casper `ToBytes` of the map key (empty for `Var`). `u32` key → 4 bytes LE.
- Stored value is wrapped `CLValue::from_t(Vec<u8>)` → CLType `List(U8)`; the CLValue bytes are
  `u32_LE(len) ++ payload` — **strip the first 4 bytes**, then `payload` is raw `T::to_bytes()`.
- `#[odra::odra_type]` struct = fields in declaration order, each Casper `ToBytes`, concatenated,
  no length prefix between fields. Tuple = members concatenated.

**Casper bytesrepr per type:** `u32`=4B LE · `u64`=8B LE · `U256`/`U512`= 1 length-byte + LE magnitude
· `String`= u32-LE len + UTF-8 · `bool`=1B · `Option<T>`= `00`/`01++T` · unit enum = u8 tag ·
`Address`= `00++32B account-hash` OR `01++32B contract-hash`.

```ts
import { blake2b } from "blakejs";
const u32LE = (n:number)=>{const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n>>>0,true);return b;};
const u32BE = (n:number)=>{const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n>>>0,false);return b;};
const idxBytes = (i:number)=> i>15 ? new Uint8Array([0xff,1,i]) : u32BE(i);
const cat=(a:Uint8Array,b:Uint8Array)=>{const o=new Uint8Array(a.length+b.length);o.set(a);o.set(b,a.length);return o;};
const varKey = (i:number)=>Buffer.from(blake2b(idxBytes(i),undefined,32)).toString("hex");
const mapKeyU32 = (i:number,k:number)=>Buffer.from(blake2b(cat(idxBytes(i),u32LE(k)),undefined,32)).toString("hex");
const stripPrefix = (clHex:string)=>Uint8Array.from(Buffer.from(clHex,"hex")).slice(4);

// bytesrepr readers
class R{constructor(public b:Uint8Array,public o=0){}}
const u8=(r:R)=>r.b[r.o++];
const u32=(r:R)=>{const v=new DataView(r.b.buffer,r.b.byteOffset+r.o,4).getUint32(0,true);r.o+=4;return v;};
const u64=(r:R)=>{const lo=BigInt(u32(r)),hi=BigInt(u32(r));return hi*(2n**32n)+lo;};
const uN=(r:R)=>{const n=u8(r);let v=0n;for(let i=0;i<n;i++)v+=BigInt(r.b[r.o+i])<<(8n*BigInt(i));r.o+=n;return v;};
const str=(r:R)=>{const n=u32(r);const s=new TextDecoder().decode(r.b.slice(r.o,r.o+n));r.o+=n;return s;};
const addr=(r:R)=>{const t=u8(r);const h=Buffer.from(r.b.slice(r.o,r.o+32)).toString("hex");r.o+=32;return (t===0?"account-hash-":"contract-")+h;};
const enm=(r:R,names:string[])=>names[u8(r)];
// Reputation { jobs_completed:u64, total_volume:U256, distinct_clients:u32, score_bps:U256, granted_out_bps:U256 }
// Agent      { owner:Address, wallet:Address, agent_uri:String, bond:U512, status:enum[Active,Slashed,Withdrawn] }
// get_summary -> (u64, U256, u8)
```

**Read-path RISKS:**
- Odra `Var`/`Mapping` never `.set()` → RPC returns "value was not found" → **treat as the type default
  (0/empty), not an error** (mirror the on-chain default-on-missing). Mandatory for `total_agents`,
  `agent_exists`, etc. Confirmed live (counts absent because nothing written yet).
- Field indices + struct field order are NOT on-chain metadata — derive from contract source, then
  **verify each decode against a known live value** (add a unit test).
- `score`/`get_summary`/`pair_stat` may be computed views — read the underlying `Reputation`/`PairStat`
  and recompute the formula in TS (mirror the Rust `&self` body). `score_bps` IS a stored field.
- Re-resolve `package → current contract_hash → state URef` per session (upgrades change contract hash).
- For multi-read snapshot consistency, fetch one SRH (`getStateRootHashLatest()`) and pass to each read.
- Public node `node.testnet.casper.network/rpc` works no-auth (good for dev); CSPR.cloud is prod path.

---

## §2. x402 client — OFFICIAL CLIENT EXISTS

**`@make-software/casper-x402`** (npm) — official, working. Repo `github.com/make-software/casper-x402`.
Also `@casper-ecosystem/casper-eip-712@1.2.1` (hashes+verifies, does NOT sign). POC: `odradev/casper-x402-poc`.

**Handshake (x402 v2):** GET → 402 `{x402Version:2, accepts:[PaymentRequirements]}` → client signs a
PaymentPayload (EIP-712 over CEP-18 `transfer_with_authorization`) → retry with `PAYMENT-SIGNATURE`
header (base64 JSON) → server `/verify` then `/settle` via facilitator (facilitator pays gas) → 200.

**402 body / PaymentRequirements (Casper):**
```json
{ "x402Version": 2, "accepts": [{
  "scheme":"exact", "network":"casper:casper-test",
  "payTo":"00<64hex account-hash>", "amount":"7500000000",
  "asset":"<64hex CEP-18 package hash>",
  "extra":{"name":"<token-name>","version":"1","decimals":"9"},
  "maxTimeoutSeconds":900 }] }
```
`amount` = base-unit integer string (decimals 9). `extra.{name,version}` feed the EIP-712 domain and
**must match the token contract** or verify fails.

**PaymentPayload (official `scheme.ts`):** `{x402Version:2, scheme:"exact", network, payload:{signature
(130hex=[algo|64]), publicKey, authorization:{from,to,value,validAfter,validBefore,nonce(64hex)}}}`.
Header = `base64(JSON.stringify(payload))` in **`PAYMENT-SIGNATURE`** (v2). Some BUIDLs use v1 `X-PAYMENT`.

**🔴 EIP-712 trap:** the official client uses an INLINE type `TransferWithAuthorization` with
`address`/`uint256`/**camelCase** `validAfter`/`validBefore` — NOT the eip-712 package's prebuilt
`TransferAuthorization`/`bytes32`/snake_case. Wrong struct → wrong digest → `invalid_signature`.
Must pass `{ domainTypes: CASPER_DOMAIN_TYPES }` (name,version,chain_name,contract_package_hash) or
Casper domain fields are silently dropped.

**Curve caveat:** local JS signer-recovery is secp256k1-only; ed25519 works end-to-end only because the
facilitator verifies on-chain (curve-agnostic). Repo testnet default = secp256k1.

**Facilitator:** `https://x402-facilitator.cspr.cloud` (testnet+mainnet, network chosen per-request).
`GET /supported`, `POST /verify`, `POST /settle`. Auth `Authorization: <token>` (raw, not Bearer) —
**401 without token** (hosted is NOT free-without-auth). Free testnet quota **25/day** (100/min) → 429.
Testnet demo asset = Wrapped CSPR `3d80df21ba4ee4d66a2a1f60c32570dd5685e4b279f6538162a5fd1314847c1e`.

**Verify network strings via `GET /supported`** (repo examples use the NCTL placeholder `casper:casper-net-1`;
hosted uses `casper:casper-test` / `casper:casper`).

---

## §3. Write path (hero flow) — VERIFIED against source

**Model:** Casper 2.0/Condor uses `Transaction`/`TransactionV1`, not legacy `Deploy`. `casper-js-sdk@5.0.12`
supports it via `ContractCallBuilder` → `.build()` → `tx.sign(key)` → `rpcClient.putTransaction(tx)`.
(Legacy `Deploy`/`putDeploy` still works but is wrong altitude.)

```ts
import { HttpHandler, RpcClient, ContractCallBuilder, Args, CLValue, PrivateKey, KeyAlgorithm } from 'casper-js-sdk';
const tx = new ContractCallBuilder()
  .from(signer.publicKey)
  .byPackageHash('fe6b0ddb...') // bare hex, NO "contract-package-" prefix
  .entryPoint('create_job')
  .runtimeArgs(Args.fromMap({
    client_id: CLValue.newCLUInt32(7), provider: CLValue.newCLUInt32(9),
    amount: CLValue.newCLUInt256('1000000000'), deadline: CLValue.newCLUint64(Date.now()+86400000),
  }))
  .chainName('casper-test').payment(2_500_000_000).build();
tx.sign(signer); await rpcClient.putTransaction(tx);
```
CLValue builders: `newCLUInt32/newCLUint64/newCLUInt256/newCLUInt512/newCLUint8/newCLString`,
`newCLKey(Key)` for Address, `newCLOption`. `.payment()` is **gas only**.

**🔴 Payable `register` needs `SessionBuilder` + Odra `proxy_caller.wasm`** — you cannot attach CSPR via
`ContractCallBuilder`. Proxy args (Odra `consts.rs`): `package_hash`, `entry_point`, `args` (inner
RuntimeArgs as bytes), `attached_value` (U512 bond = 10 CSPR), `amount` (U512, == attached_value, grants
main-purse access). Bond is separate from gas. **Get `proxy_caller.wasm` from the `cargo odra build` output.**
Doc-vs-source arg-name discrepancy (`contract_package_hash` BytesArray vs `package_hash`) — verify against
the exact Odra 2.8 build before wiring.

**CEP-18 allowance:** `allowance[owner][spender]`, owner=caller of `approve`. Flow: client `approve(spender=escrow,
amount)` → escrow `transfer_from(owner=client, recipient=escrow)`. Arg names: `approve`→`spender`,`amount`;
`balance_of`→`address`. Sequence txs (poll approve before create_job).

**CSPR.cloud:** RPC `https://node.testnet.cspr.cloud/rpc`, SSE `https://node-sse.testnet.cspr.cloud`,
`Authorization: <UUID>` (not Bearer). Faucet `testnet.cspr.live/tools/faucet` ~1000 CSPR once/account.

**Keys:** `PrivateKey.generate(KeyAlgorithm.ED25519)`, `.fromHex/.fromPem`, `pk.publicKey`,
`publicKey.accountHash()`, `CLValue.newCLKey(Key.fromAccountHash(accountHash))`.

**Write RISKS:** legacy-Deploy-vs-Transaction doc confusion (trust v5 README); payable register via
proxy_caller is #1 risk (verify arg names + inner `args` byte format vs Odra 2.8); gas `payment` is a
guess (dry-run via speculative_exec); CSPR.cloud quota; pre-fund all demo accounts.

---

## Sources
casper-js-sdk@5.0.12 (github.com/casper-ecosystem/casper-js-sdk `dev`) · odra.dev/docs/backends ·
github.com/make-software/casper-x402 · github.com/casper-ecosystem/casper-eip-712 ·
docs.cspr.cloud/x402-facilitator-api · github.com/casper-ecosystem/cep18 · coinbase/x402 v2 spec.
