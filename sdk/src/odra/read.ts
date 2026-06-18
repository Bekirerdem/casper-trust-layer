import {
  ParamDictionaryIdentifier,
  ParamDictionaryIdentifierContractNamedKey,
  type RpcClient,
} from "casper-js-sdk";

/**
 * Reads a single Odra dictionary item from the "state" named key on a contract.
 *
 * Returns the raw payload bytes with the 4-byte List<U8> length prefix stripped,
 * or null if the item does not exist (Odra stores type-defaults as absent keys).
 *
 * itemKeyHex: hex string of the dictionary item key (from varKey() / mapKeyU32())
 */
export async function readOdraValue(
  rpc: RpcClient,
  contractHashHex: string,
  itemKeyHex: string,
): Promise<Uint8Array | null> {
  // contractNamedKey must be a proper class instance (TypedJSON rejects plain objects)
  const contractNamedKey = new ParamDictionaryIdentifierContractNamedKey(
    `hash-${contractHashHex}`,
    "state",
    itemKeyHex,
  );
  const id = new ParamDictionaryIdentifier(undefined, contractNamedKey, undefined, undefined);

  try {
    const res = await rpc.getDictionaryItemByIdentifier(null, id);

    // Use rawJSON (the raw RPC response) to get the hex bytes string.
    // Path: rawJSON.stored_value.CLValue.bytes — snake_case keys in raw JSON.
    // CLValue encoding for List<U8>: 4-byte LE length prefix followed by payload.
    const clHex: string = res.rawJSON?.stored_value?.CLValue?.bytes;
    if (typeof clHex !== "string" || clHex.length === 0) {
      // Fallback: clValue.bytes() returns the full CLValue byte encoding for List<U8>,
      // which is a 4-byte LE u32 length prefix followed by the payload — same layout
      // as the rawJSON hex path above, so we slice(4) identically.
      const clBytes = res.storedValue.clValue?.bytes();
      if (!clBytes || clBytes.length < 4) return null;
      return clBytes.slice(4);
    }

    const full = Uint8Array.from(Buffer.from(clHex, "hex"));
    // Strip 4-byte LE u32 length prefix that Odra prepends to every List<U8>
    return full.slice(4);
  } catch (e: any) {
    // getDictionaryItemByIdentifier wraps the JSON-RPC error: the -32003 (QueryFailed)
    // code is on e.statusCode / e.sourceErr.code, NOT e.code. -32003 = the key is simply
    // absent (Odra stores type-defaults as missing keys); any other error must propagate.
    const code = e?.code ?? e?.statusCode ?? e?.sourceErr?.code;
    if (code === -32003) return null;
    throw e;
  }
}
