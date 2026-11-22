import {
  binToHex,
  hexToBin,
  hash256,
  hash160,
  encodeCashAddress,
  CashAddressNetworkPrefix,
} from '@bitauth/libauth';

/** Reverse byte order in a hex string (e.g. big-endian category to little-endian constructor parameter). */
export function reverseHex(hex: string): string {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const match = clean.match(/.{2}/g);
  return match ? match.reverse().join('') : '';
}

/** Converts CashToken category hex to little-endian Uint8Array. */
export function categoryToBytes(catHex: string): Uint8Array {
  if (!catHex || catHex === '0x' || catHex === '') return new Uint8Array(0);
  const clean = catHex.startsWith('0x') ? catHex.slice(2) : catHex;
  return hexToBin(reverseHex(clean));
}

/** Formats a 32-byte hash as little-endian bytes for constructor parameter. */
export function hashToBytesLE(hashHex: string): Uint8Array {
  return hexToBin(reverseHex(hashHex));
}

/**
 * Encodes an integer as a Script Number (CScriptNum format, little-endian sign-magnitude).
 * Essential for CashScript constructor parameter serialization.
 */
export function encodeScriptNumber(val: bigint | number): Uint8Array {
  let n = typeof val === 'number' ? BigInt(val) : val;
  if (n === 0n) return new Uint8Array(0);

  const isNegative = n < 0n;
  if (isNegative) n = -n;

  const bytes: number[] = [];
  while (n > 0n) {
    bytes.push(Number(n & 0xffn));
    n >>= 8n;
  }

  // If the highest bit is set, add an extra byte to carry the sign
  if (bytes[bytes.length - 1] & 0x80) {
    bytes.push(isNegative ? 0x80 : 0x00);
  } else if (isNegative) {
    bytes[bytes.length - 1] |= 0x80;
  }

  return new Uint8Array(bytes);
}

/**
 * Pushes raw bytes as a Script push operation (handles direct opcode, OP_PUSHBYTES, OP_PUSHDATA1/2).
 */
export function encodePush(bytes: Uint8Array): Uint8Array {
  const len = bytes.length;
  if (len === 0) return new Uint8Array([0x00]); // OP_0
  if (len === 1 && bytes[0] >= 1 && bytes[0] <= 16) {
    return new Uint8Array([0x50 + bytes[0]]); // OP_1 through OP_16
  }
  if (len === 1 && bytes[0] === 0x81) {
    return new Uint8Array([0x4f]); // OP_1NEGATE
  }
  if (len <= 75) {
    return new Uint8Array([len, ...bytes]);
  }
  if (len <= 255) {
    return new Uint8Array([0x4c, len, ...bytes]); // OP_PUSHDATA1
  }
  if (len <= 65535) {
    return new Uint8Array([0x4d, len & 0xff, (len >> 8) & 0xff, ...bytes]); // OP_PUSHDATA2
  }
  throw new Error(`Push size ${len} exceeds supported length`);
}

/** Computes P2SH32 locking bytecode from redeem script bytes: OP_HASH256 <32-byte-hash> OP_EQUAL */
export function redeemScriptToP2SH32(redeemScript: Uint8Array): Uint8Array {
  const scriptHash = hash256(redeemScript);
  return new Uint8Array([0xaa, 0x20, ...scriptHash, 0x87]);
}

/** Formats P2SH32 locking bytecode into a cashaddress string. */
export function p2sh32ToAddress(lockingBytecode: Uint8Array, network: 'chipnet' | 'mainnet'): string {
  const prefix =
    network === 'chipnet'
      ? CashAddressNetworkPrefix.testnet
      : CashAddressNetworkPrefix.mainnet;
  const payload = lockingBytecode.slice(2, 34); // extract the 32-byte hash
  const result = encodeCashAddress({
    prefix,
    type: 'p2sh',
    payload,
  });
  if (typeof result === 'string') throw new Error(result);
  return result.address;
}
