import type { Output, Transaction } from '@bitauth/libauth';
import type { WalletSignTxRequest } from '../../types';

/**
 * Adapter that formats LimitOrderSwap transactions into the WalletConnect BCH /
 * bch_signTransaction format accepted by bch-intents-wallet-extension.
 *
 * When bch-intents-wallet-extension receives this payload:
 * 1. It recognizes sourceOutputs[0].contract and searches for the 65-byte zero placeholder signature.
 * 2. It verifies the contract's outputs match user intent.
 * 3. It computes the ECDSA / Schnorr signature with the active account's private key.
 * 4. It substitutes the signature placeholder in unlockingBytecode and returns or broadcasts the transaction.
 */
export function toWalletSignTxRequest(options: {
  transaction: Transaction;
  sourceOutputs: Output[];
  redeemScript: Uint8Array;
  contractName?: string;
  broadcast?: boolean;
  userPrompt?: string;
}): WalletSignTxRequest {
  const {
    transaction,
    sourceOutputs,
    redeemScript,
    contractName = 'LimitOrderSwap',
    broadcast = false,
    userPrompt = 'Sign Mesh Limit Order Contract Action',
  } = options;

  // Augment the first source output with the contract metadata
  const augmentedSourceOutputs = sourceOutputs.map((output, index) => {
    if (index === 0) {
      return {
        ...output,
        contract: {
          name: contractName,
          artifact: { contractName },
          redeemScript,
        },
      };
    }
    return output;
  });

  return {
    transaction,
    sourceOutputs: augmentedSourceOutputs as WalletSignTxRequest['sourceOutputs'],
    broadcast,
    userPrompt,
  };
}
