import {
  hexToBin,
  binToHex,
  hash256,
  hash160,
  encodeLockingBytecodeP2pkh,
} from '@bitauth/libauth';
import {
  encodePush,
  encodeScriptNumber,
  categoryToBytes,
  redeemScriptToP2SH32,
  p2sh32ToAddress,
} from '../../utils/encoding';

/**
 * LimitOrderSwap constructor parameters matching LimitOrderSwap.cash
 */
export interface LimitOrderParams {
  /** 20-byte maker public key hash (hex or Uint8Array) */
  makerPkh: string | Uint8Array;
  /** CashToken category hex (0x or empty string for native BCH) */
  sellTokenCategory: string;
  /** CashToken category hex (0x or empty string for native BCH) */
  buyTokenCategory: string;
  /** Amount of sell tokens or satoshis locked */
  sellAmount: bigint;
  /** Fixed buy amount of tokens or satoshis required from resolver */
  buyAmount: bigint;
  /** Expiry time (unix timestamp in seconds) */
  expiryTime: bigint | number;
}

/**
 * Compiled bytecode of LimitOrderSwap.cash from contracts-bch-swap/artifacts/LimitOrderSwap.json
 */
export const LIMIT_ORDER_BYTECODE_HEX =
  '5679009c63587a5879adc3529dc576040065cd1da269567a9f690376a9147c7e0288ac7e00cd887800876300cc5479a2696700d152798800d35479a26900cc02e803a26968557aa90376a9147c7e0288ac7e51cd887600876351cc5379a2696751d1788851d35379a269686d6d7551675679519c63557ab1750376a9147c7e0288ac7e00cd887600876300cc5379a2696700d1788800d35379a269686d6d755167567a529d5679a97888577a577aad0376a9147c7e0288ac7e00cd887600876300cc5379a2696700d1788800d35379a269686d6d75516868';

export const LIMIT_ORDER_BYTECODE = hexToBin(LIMIT_ORDER_BYTECODE_HEX);

/**
 * Assembles the concrete redeem script for LimitOrderSwap by prepending
 * constructor argument pushes in reverse order onto the compiled bytecode.
 *
 * Constructor parameters:
 *   0: makerPkh (bytes20)
 *   1: sellTokenCategory (bytes, little-endian)
 *   2: buyTokenCategory (bytes, little-endian)
 *   3: sellAmount (int)
 *   4: buyAmount (int)
 *   5: expiryTime (int)
 *
 * Pushes emitted: push(expiryTime) push(buyAmount) push(sellAmount) push(buyCat) push(sellCat) push(makerPkh)
 */
export function buildLimitOrderRedeemScript(params: LimitOrderParams): Uint8Array {
  const makerPkhBytes = typeof params.makerPkh === 'string'
    ? hexToBin(params.makerPkh.replace(/^0x/, ''))
    : params.makerPkh;

  if (makerPkhBytes.length !== 20) {
    throw new Error(`makerPkh must be 20 bytes, got ${makerPkhBytes.length}`);
  }

  const sellCatBytes = categoryToBytes(params.sellTokenCategory);
  const buyCatBytes = categoryToBytes(params.buyTokenCategory);

  const pushExpiry = encodePush(encodeScriptNumber(params.expiryTime));
  const pushBuyAmount = encodePush(encodeScriptNumber(params.buyAmount));
  const pushSellAmount = encodePush(encodeScriptNumber(params.sellAmount));
  const pushBuyCat = encodePush(buyCatBytes);
  const pushSellCat = encodePush(sellCatBytes);
  const pushMakerPkh = encodePush(makerPkhBytes);

  const totalLength =
    pushExpiry.length +
    pushBuyAmount.length +
    pushSellAmount.length +
    pushBuyCat.length +
    pushSellCat.length +
    pushMakerPkh.length +
    LIMIT_ORDER_BYTECODE.length;

  const result = new Uint8Array(totalLength);
  let offset = 0;

  result.set(pushExpiry, offset);
  offset += pushExpiry.length;
  result.set(pushBuyAmount, offset);
  offset += pushBuyAmount.length;
  result.set(pushSellAmount, offset);
  offset += pushSellAmount.length;
  result.set(pushBuyCat, offset);
  offset += pushBuyCat.length;
  result.set(pushSellCat, offset);
  offset += pushSellCat.length;
  result.set(pushMakerPkh, offset);
  offset += pushMakerPkh.length;
  result.set(LIMIT_ORDER_BYTECODE, offset);

  return result;
}

/** Computes the P2SH32 locking bytecode for an instantiated LimitOrder covenant. */
export function getLimitOrderLockingBytecode(params: LimitOrderParams): Uint8Array {
  const redeemScript = buildLimitOrderRedeemScript(params);
  return redeemScriptToP2SH32(redeemScript);
}

/** Derives the CashAddress for an instantiated LimitOrder covenant. */
export function getLimitOrderAddress(params: LimitOrderParams, network: 'chipnet' | 'mainnet'): string {
  const lockingBytecode = getLimitOrderLockingBytecode(params);
  return p2sh32ToAddress(lockingBytecode, network);
}

/**
 * Builds the unlocking script for function 0: fill(resolverPk, resolverSig).
 * Stack: [resolverSig, resolverPk, 0, redeemScript]
 */
export function buildFillUnlockingScript(
  resolverPk: Uint8Array,
  resolverSig: Uint8Array,
  redeemScript: Uint8Array
): Uint8Array {
  const pushSig = encodePush(resolverSig);
  const pushPk = encodePush(resolverPk);
  const pushFunc = encodePush(new Uint8Array(0)); // OP_0 for fill()
  const pushRedeem = encodePush(redeemScript);

  const total = pushSig.length + pushPk.length + pushFunc.length + pushRedeem.length;
  const script = new Uint8Array(total);
  let off = 0;

  script.set(pushSig, off); off += pushSig.length;
  script.set(pushPk, off); off += pushPk.length;
  script.set(pushFunc, off); off += pushFunc.length;
  script.set(pushRedeem, off);

  return script;
}

/**
 * Builds the unlocking script for function 1: cancel().
 * Stack: [1, redeemScript]
 */
export function buildCancelUnlockingScript(redeemScript: Uint8Array): Uint8Array {
  const pushFunc = encodePush(new Uint8Array([0x01])); // OP_1 for cancel()
  const pushRedeem = encodePush(redeemScript);

  const total = pushFunc.length + pushRedeem.length;
  const script = new Uint8Array(total);
  let off = 0;

  script.set(pushFunc, off); off += pushFunc.length;
  script.set(pushRedeem, off);

  return script;
}

/**
 * Builds the unlocking script for function 2: cancelEarly(makerPk, makerSig).
 * Stack: [makerSig, makerPk, 2, redeemScript]
 */
export function buildCancelEarlyUnlockingScript(
  makerPk: Uint8Array,
  makerSig: Uint8Array,
  redeemScript: Uint8Array
): Uint8Array {
  const pushSig = encodePush(makerSig);
  const pushPk = encodePush(makerPk);
  const pushFunc = encodePush(new Uint8Array([0x02])); // OP_2 for cancelEarly()
  const pushRedeem = encodePush(redeemScript);

  const total = pushSig.length + pushPk.length + pushFunc.length + pushRedeem.length;
  const script = new Uint8Array(total);
  let off = 0;

  script.set(pushSig, off); off += pushSig.length;
  script.set(pushPk, off); off += pushPk.length;
  script.set(pushFunc, off); off += pushFunc.length;
  script.set(pushRedeem, off);

  return script;
}
