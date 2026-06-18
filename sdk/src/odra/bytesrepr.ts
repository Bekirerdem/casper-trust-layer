export class Reader {
  constructor(public b: Uint8Array, public o = 0) {}
}
export const u8 = (r: Reader) => r.b[r.o++];
export const u32 = (r: Reader) => {
  const v = new DataView(r.b.buffer, r.b.byteOffset + r.o, 4).getUint32(0, true); r.o += 4; return v;
};
export const u64 = (r: Reader) => { const lo = BigInt(u32(r)), hi = BigInt(u32(r)); return hi * (2n ** 32n) + lo; };
export const uN = (r: Reader) => { // U256/U512: 1 length byte + LE magnitude
  const n = u8(r); let v = 0n;
  for (let i = 0; i < n; i++) v += BigInt(r.b[r.o + i]) << (8n * BigInt(i));
  r.o += n; return v;
};
export const bool = (r: Reader) => u8(r) === 1;
export const str = (r: Reader) => {
  const n = u32(r); const s = new TextDecoder().decode(r.b.slice(r.o, r.o + n)); r.o += n; return s;
};
export const addr = (r: Reader) => {
  const tag = u8(r); const h = Buffer.from(r.b.slice(r.o, r.o + 32)).toString("hex"); r.o += 32;
  return (tag === 0 ? "account-hash-" : "contract-") + h;
};
export const option = <T>(r: Reader, f: (r: Reader) => T): T | null => (u8(r) === 1 ? f(r) : null);
export const unitEnum = (r: Reader, names: string[]) => names[u8(r)];
