import type { MeshXOTemplate } from '../../types';
import {
  type LimitOrderParams,
  getLimitOrderLockingBytecode,
  getLimitOrderAddress,
  buildLimitOrderRedeemScript,
} from './contract';
import { MESH_LIMIT_ORDER_XO_TEMPLATE, computeTemplateIdentifier } from './template';
import {
  buildCancelEarlyTransaction,
  buildFillTransaction,
  buildCancelTransaction,
} from './builders';
import { toWalletSignTxRequest } from './adapter';

export * from './contract';
export * from './template';
export * from './builders';
export * from './adapter';

/**
 * Benchmark Mesh Limit Order XO Template Instance.
 * Encapsulates the complete lifecycle: blueprint, bytecode compilation, action builders,
 * and wallet signing adapters.
 */
export const MeshLimitOrderTemplate: MeshXOTemplate<
  LimitOrderParams,
  {
    buildCancelEarlyTransaction: typeof buildCancelEarlyTransaction;
    buildFillTransaction: typeof buildFillTransaction;
    buildCancelTransaction: typeof buildCancelTransaction;
    toWalletSignTxRequest: typeof toWalletSignTxRequest;
  }
> = {
  id: 'mesh-limit-order-v1',
  template: MESH_LIMIT_ORDER_XO_TEMPLATE,
  templateIdentifier: computeTemplateIdentifier(MESH_LIMIT_ORDER_XO_TEMPLATE),

  compileLockingBytecode(params: LimitOrderParams): Uint8Array {
    return getLimitOrderLockingBytecode(params);
  },

  deriveAddress(params: LimitOrderParams, network: 'chipnet' | 'mainnet'): string {
    return getLimitOrderAddress(params, network);
  },

  actions: {
    buildCancelEarlyTransaction,
    buildFillTransaction,
    buildCancelTransaction,
    toWalletSignTxRequest,
  },
};
