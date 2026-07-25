import {
  ParamDictionaryIdentifier,
  ParamDictionaryIdentifierContractNamedKey,
  type RpcClient,
} from "casper-js-sdk";

/**
 * Shared Odra storage reader. Odra keeps every module field in a single "state"
 * dictionary, keyed by blake2b of the field index — so reading contract state
 * without an entry-point call means addressing that dictionary directly.
 *
 * Kept local to the web app: it consumes the published npm SDK, which does not
 * export these internals.
 */

const contractHashCache = new Map<string, string>();

/** Resolves a contract package to its newest contract hash (cached per package). */
export async function resolveContractHash(
  rpc: RpcClient,
  packageHashHex: string,
): Promise<string> {
  const cached = contractHashCache.get(packageHashHex);
  if (cached) return cached;
  const pkg = await rpc.queryLatestGlobalState(`hash-${packageHashHex}`, []);
  const versions = pkg.storedValue.contractPackage?.versions;
  if (!versions || versions.length === 0) {
    throw new Error(`package ${packageHashHex.slice(0, 8)} has no versions`);
  }
  const hash = versions[versions.length - 1].contractHash.hash.toHex();
  contractHashCache.set(packageHashHex, hash);
  return hash;
}

/**
 * Reads one item from a contract's "state" dictionary.
 * Returns the payload with the 4-byte List<U8> length prefix stripped, or null
 * when the key is absent — Odra stores type-defaults by simply not writing them,
 * so "missing" means "zero/empty", not "error".
 */
export async function readOdraValue(
  rpc: RpcClient,
  contractHashHex: string,
  itemKeyHex: string,
): Promise<Uint8Array | null> {
  const contractNamedKey = new ParamDictionaryIdentifierContractNamedKey(
    `hash-${contractHashHex}`,
    "state",
    itemKeyHex,
  );
  const id = new ParamDictionaryIdentifier(undefined, contractNamedKey, undefined, undefined);
  try {
    const res = await rpc.getDictionaryItemByIdentifier(null, id);
    const clHex: string | undefined = res.rawJSON?.stored_value?.CLValue?.bytes;
    if (typeof clHex === "string" && clHex.length > 0) {
      return Uint8Array.from(Buffer.from(clHex, "hex")).slice(4);
    }
    const clBytes = res.storedValue.clValue?.bytes();
    if (!clBytes || clBytes.length < 4) return null;
    return clBytes.slice(4);
  } catch (e) {
    // -32003 (QueryFailed) = key absent.
    const err = e as { code?: number; statusCode?: number; sourceErr?: { code?: number } };
    const code = err?.code ?? err?.statusCode ?? err?.sourceErr?.code;
    if (code === -32003) return null;
    throw e;
  }
}

/** Odra U256/U512 encoding: one length byte, then little-endian magnitude. */
export function decodeU256(raw: Uint8Array | null): bigint {
  const zero = BigInt(0);
  if (!raw || raw.length === 0) return zero;
  const len = raw[0];
  if (len === 0 || raw.length < 1 + len) return zero;
  let v = zero;
  for (let i = 0; i < len; i++) {
    v += BigInt(raw[1 + i]) * BigInt(256) ** BigInt(i);
  }
  return v;
}

/** Odra bool: a single byte. Absent means false. */
export function decodeBool(raw: Uint8Array | null): boolean {
  return !!raw && raw.length > 0 && raw[raw.length - 1] === 1;
}
