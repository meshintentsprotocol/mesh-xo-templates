import {
  encodeLockingBytecodeP2pkh,
  hexToBin,
  binToHex,
  type Output,
  type Transaction,
} from '@bitauth/libauth';
import {
  type LimitOrderParams,
  buildLimitOrderRedeemScript,
  getLimitOrderLockingBytecode,
  buildCancelEarlyUnlockingScript,
  buildFillUnlockingScript,
  buildCancelUnlockingScript,
} from './contract';

export interface Outpoint {
  txid: string;
  vout: number;
  satoshis: bigint;
  token?: {
    category: string;
    amount: bigint;
  };
}

export const SIG_PLACEHOLDER = new Uint8Array(65);

/**
 * Builds the transaction for early cancellation of an order by the maker.
 * Places a 65-byte zero signature placeholder in the covenant unlocking script
 * for the wallet extension to replace during bch_signTransaction.
 */
export function buildCancelEarlyTransaction(options: {
  orderParams: LimitOrderParams;
  orderUtxo: Outpoint;
  feeUtxo: Outpoint;
  makerPk: Uint8Array;
  makerPkh: Uint8Array;
  feePkh: Uint8Array;
  feeSatoshis?: bigint;
}): {
  transaction: Transaction;
  sourceOutputs: Output[];
  redeemScript: Uint8Array;
} {
  const { orderParams, orderUtxo, feeUtxo, makerPk, makerPkh, feePkh } = options;
  const fee = options.feeSatoshis ?? 1500n;

  const redeemScript = buildLimitOrderRedeemScript(orderParams);
  const covenantLockingBytecode = getLimitOrderLockingBytecode(orderParams);
  const makerLockingBytecode = encodeLockingBytecodeP2pkh(makerPkh);
  const feeLockingBytecode = encodeLockingBytecodeP2pkh(feePkh);

  // Unlocking script for Input 0: [placeholderSig, makerPk, OP_2, redeemScript]
  const covenantUnlockingScript = buildCancelEarlyUnlockingScript(
    makerPk,
    SIG_PLACEHOLDER,
    redeemScript
  );

  const isSellToken = orderParams.sellTokenCategory && orderParams.sellTokenCategory !== '0x';

  // Output 0: Returns locked funds to the maker
  const out0: Output = isSellToken
    ? {
        lockingBytecode: makerLockingBytecode,
        valueSatoshis: orderUtxo.satoshis, // keep carrier satoshis
        token: {
          category: hexToBin(orderParams.sellTokenCategory.replace(/^0x/, '')),
          amount: orderParams.sellAmount,
        },
      }
    : {
        lockingBytecode: makerLockingBytecode,
        valueSatoshis: orderParams.sellAmount,
      };

  // Output 1: Fee change back to the fee payer
  const changeSatoshis = feeUtxo.satoshis - fee;
  if (changeSatoshis < 546n) {
    throw new Error(`Fee input satoshis (${feeUtxo.satoshis}) insufficient to pay fee (${fee})`);
  }

  const out1: Output = {
    lockingBytecode: feeLockingBytecode,
    valueSatoshis: changeSatoshis,
  };

  const transaction: Transaction = {
    version: 2,
    locktime: 0,
    inputs: [
      {
        outpointIndex: orderUtxo.vout,
        outpointTransactionHash: hexToBin(orderUtxo.txid),
        sequenceNumber: 0xfffffffe,
        unlockingBytecode: covenantUnlockingScript,
      },
      {
        outpointIndex: feeUtxo.vout,
        outpointTransactionHash: hexToBin(feeUtxo.txid),
        sequenceNumber: 0xfffffffe,
        unlockingBytecode: new Uint8Array(0), // empty for wallet to sign
      },
    ],
    outputs: [out0, out1],
  };

  const sourceOutputs: Output[] = [
    {
      lockingBytecode: covenantLockingBytecode,
      valueSatoshis: orderUtxo.satoshis,
      token: orderUtxo.token
        ? {
            category: hexToBin(orderUtxo.token.category.replace(/^0x/, '')),
            amount: orderUtxo.token.amount,
          }
        : undefined,
    },
    {
      lockingBytecode: feeLockingBytecode,
      valueSatoshis: feeUtxo.satoshis,
    },
  ];

  return { transaction, sourceOutputs, redeemScript };
}

/**
 * Builds the fill transaction executed by a resolver.
 */
export function buildFillTransaction(options: {
  orderParams: LimitOrderParams;
  orderUtxo: Outpoint;
  resolverUtxo: Outpoint;
  resolverPk: Uint8Array;
  resolverPkh: Uint8Array;
  makerPkh: Uint8Array;
  currentTime: number; // Unix timestamp, must be >= 500000000 and < expiryTime
  feeSatoshis?: bigint;
}): {
  transaction: Transaction;
  sourceOutputs: Output[];
  redeemScript: Uint8Array;
} {
  const { orderParams, orderUtxo, resolverUtxo, resolverPk, resolverPkh, makerPkh, currentTime } = options;
  const fee = options.feeSatoshis ?? 1500n;

  if (currentTime < 500000000 || BigInt(currentTime) >= BigInt(orderParams.expiryTime)) {
    throw new Error(`Current time ${currentTime} is not valid for filling order with expiry ${orderParams.expiryTime}`);
  }

  const redeemScript = buildLimitOrderRedeemScript(orderParams);
  const covenantLockingBytecode = getLimitOrderLockingBytecode(orderParams);
  const makerLockingBytecode = encodeLockingBytecodeP2pkh(makerPkh);
  const resolverLockingBytecode = encodeLockingBytecodeP2pkh(resolverPkh);

  // Unlocking script for Input 0: [placeholderSig, resolverPk, OP_0, redeemScript]
  const covenantUnlockingScript = buildFillUnlockingScript(
    resolverPk,
    SIG_PLACEHOLDER,
    redeemScript
  );

  const isBuyToken = orderParams.buyTokenCategory && orderParams.buyTokenCategory !== '0x';
  const isSellToken = orderParams.sellTokenCategory && orderParams.sellTokenCategory !== '0x';

  // Output 0: Must send exactly buyAmount of buyToken to maker
  const out0: Output = isBuyToken
    ? {
        lockingBytecode: makerLockingBytecode,
        valueSatoshis: 1000n, // minimum carrier satoshis per contract rule
        token: {
          category: hexToBin(orderParams.buyTokenCategory.replace(/^0x/, '')),
          amount: orderParams.buyAmount,
        },
      }
    : {
        lockingBytecode: makerLockingBytecode,
        valueSatoshis: orderParams.buyAmount,
      };

  // Output 1: Must send sell tokens or satoshis to resolver
  const out1: Output = isSellToken
    ? {
        lockingBytecode: resolverLockingBytecode,
        valueSatoshis: orderUtxo.satoshis,
        token: {
          category: hexToBin(orderParams.sellTokenCategory.replace(/^0x/, '')),
          amount: orderParams.sellAmount,
        },
      }
    : {
        lockingBytecode: resolverLockingBytecode,
        valueSatoshis: orderParams.sellAmount,
      };

  // Calculate resolver change
  const totalInputSats = orderUtxo.satoshis + resolverUtxo.satoshis;
  const totalOutputSats = out0.valueSatoshis + out1.valueSatoshis;
  const changeSatoshis = totalInputSats - totalOutputSats - fee;

  const outputs = [out0, out1];
  if (changeSatoshis >= 546n) {
    outputs.push({
      lockingBytecode: resolverLockingBytecode,
      valueSatoshis: changeSatoshis,
    });
  }

  const transaction: Transaction = {
    version: 2,
    locktime: currentTime,
    inputs: [
      {
        outpointIndex: orderUtxo.vout,
        outpointTransactionHash: hexToBin(orderUtxo.txid),
        sequenceNumber: 0xfffffffe,
        unlockingBytecode: covenantUnlockingScript,
      },
      {
        outpointIndex: resolverUtxo.vout,
        outpointTransactionHash: hexToBin(resolverUtxo.txid),
        sequenceNumber: 0xfffffffe,
        unlockingBytecode: new Uint8Array(0),
      },
    ],
    outputs,
  };

  const sourceOutputs: Output[] = [
    {
      lockingBytecode: covenantLockingBytecode,
      valueSatoshis: orderUtxo.satoshis,
      token: orderUtxo.token
        ? {
            category: hexToBin(orderUtxo.token.category.replace(/^0x/, '')),
            amount: orderUtxo.token.amount,
          }
        : undefined,
    },
    {
      lockingBytecode: resolverLockingBytecode,
      valueSatoshis: resolverUtxo.satoshis,
      token: resolverUtxo.token
        ? {
            category: hexToBin(resolverUtxo.token.category.replace(/^0x/, '')),
            amount: resolverUtxo.token.amount,
          }
        : undefined,
    },
  ];

  return { transaction, sourceOutputs, redeemScript };
}

/**
 * Builds the post-expiry cancellation transaction (permissionless).
 */
export function buildCancelTransaction(options: {
  orderParams: LimitOrderParams;
  orderUtxo: Outpoint;
  feeUtxo: Outpoint;
  makerPkh: Uint8Array;
  feePkh: Uint8Array;
  locktime: number; // Must be >= orderParams.expiryTime
  feeSatoshis?: bigint;
}): {
  transaction: Transaction;
  sourceOutputs: Output[];
  redeemScript: Uint8Array;
} {
  const { orderParams, orderUtxo, feeUtxo, makerPkh, feePkh, locktime } = options;
  const fee = options.feeSatoshis ?? 1500n;

  if (BigInt(locktime) < BigInt(orderParams.expiryTime)) {
    throw new Error(`Locktime ${locktime} must be >= expiryTime ${orderParams.expiryTime} to cancel`);
  }

  const redeemScript = buildLimitOrderRedeemScript(orderParams);
  const covenantLockingBytecode = getLimitOrderLockingBytecode(orderParams);
  const makerLockingBytecode = encodeLockingBytecodeP2pkh(makerPkh);
  const feeLockingBytecode = encodeLockingBytecodeP2pkh(feePkh);

  // Unlocking script for Input 0: [OP_1, redeemScript]
  const covenantUnlockingScript = buildCancelUnlockingScript(redeemScript);

  const isSellToken = orderParams.sellTokenCategory && orderParams.sellTokenCategory !== '0x';

  // Output 0: Must send locked funds back to maker
  const out0: Output = isSellToken
    ? {
        lockingBytecode: makerLockingBytecode,
        valueSatoshis: orderUtxo.satoshis,
        token: {
          category: hexToBin(orderParams.sellTokenCategory.replace(/^0x/, '')),
          amount: orderParams.sellAmount,
        },
      }
    : {
        lockingBytecode: makerLockingBytecode,
        valueSatoshis: orderParams.sellAmount,
      };

  const changeSatoshis = feeUtxo.satoshis - fee;
  if (changeSatoshis < 546n) {
    throw new Error(`Fee input satoshis (${feeUtxo.satoshis}) insufficient to pay fee (${fee})`);
  }

  const out1: Output = {
    lockingBytecode: feeLockingBytecode,
    valueSatoshis: changeSatoshis,
  };

  const transaction: Transaction = {
    version: 2,
    locktime,
    inputs: [
      {
        outpointIndex: orderUtxo.vout,
        outpointTransactionHash: hexToBin(orderUtxo.txid),
        sequenceNumber: 0xfffffffe,
        unlockingBytecode: covenantUnlockingScript,
      },
      {
        outpointIndex: feeUtxo.vout,
        outpointTransactionHash: hexToBin(feeUtxo.txid),
        sequenceNumber: 0xfffffffe,
        unlockingBytecode: new Uint8Array(0),
      },
    ],
    outputs: [out0, out1],
  };

  const sourceOutputs: Output[] = [
    {
      lockingBytecode: covenantLockingBytecode,
      valueSatoshis: orderUtxo.satoshis,
      token: orderUtxo.token
        ? {
            category: hexToBin(orderUtxo.token.category.replace(/^0x/, '')),
            amount: orderUtxo.token.amount,
          }
        : undefined,
    },
    {
      lockingBytecode: feeLockingBytecode,
      valueSatoshis: feeUtxo.satoshis,
    },
  ];

  return { transaction, sourceOutputs, redeemScript };
}
