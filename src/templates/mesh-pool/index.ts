/**
 * Mesh Pool V3 XO Template Blueprint (Future Expansion).
 *
 * Models Mesh liquidity pool bin covenants (MeshPoolV3.cash / MeshBinV4.cash)
 * into standard XO declarative templates.
 *
 * Lifecycle:
 * - start: Provider deposits pair liquidity and receives pool share / position NFT.
 * - swap: Solver executes multi-bin swap satisfying invariant reserves and fees.
 * - withdraw: Provider burns position token and reclaims proportional reserves.
 */

import type { XOTemplate } from '../../types';

export const MESH_POOL_V3_XO_TEMPLATE: XOTemplate = {
  name: 'Mesh Liquidity Pool V3',
  description:
    'Concentrated liquidity bin covenant on Bitcoin Cash. Enforces exact swap invariants, fee accumulation, and position NFT minting/burning.',
  icon: 'layers',
  version: '1.0.0',
  supportedVmVersions: ['BCH_2025_05'],
  variables: {
    poolId: {
      name: 'Pool Identifier',
      description: 'Unique 32-byte CashToken category ID identifying the liquidity pool',
      type: 'bytes32',
    },
    binStep: {
      name: 'Bin Step',
      description: 'Price spacing between liquidity bins in basis points',
      type: 'int',
    },
    feeBps: {
      name: 'Protocol Fee BPS',
      description: 'Swap fee in basis points directed to LP reserves and protocol',
      type: 'int',
    },
  },
  lockingScripts: {
    poolCovenant: {
      name: 'Mesh Pool Bin Covenant',
      description: 'P2SH32 covenant validating reserve preservation and swap invariant',
      lockingType: 'p2sh32',
      lockingScript: '/* Compiled MeshPoolV3 bytecode placeholder */',
      roles: {
        lp: {
          actions: ['deposit', 'withdraw'],
        },
        solver: {
          actions: ['swap'],
        },
      },
    },
  },
};
