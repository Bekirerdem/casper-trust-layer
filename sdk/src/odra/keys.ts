import { blake2b } from "blakejs";

const u32LE = (n: number) => {
  const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n >>> 0, true); return b;
};
const u32BE = (n: number) => {
  const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n >>> 0, false); return b;
};
// Odra: index_bytes = u32 big-endian of the field index for indices <= 15.
const idxBytes = (i: number) => (i > 15 ? Uint8Array.from([0xff, 1, i]) : u32BE(i));
const cat = (a: Uint8Array, b: Uint8Array) => { const o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; };
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

export const varKey = (fieldIndex: number) => hex(blake2b(idxBytes(fieldIndex), undefined, 32));
export const mapKeyU32 = (fieldIndex: number, mapKey: number) =>
  hex(blake2b(cat(idxBytes(fieldIndex), u32LE(mapKey)), undefined, 32));
