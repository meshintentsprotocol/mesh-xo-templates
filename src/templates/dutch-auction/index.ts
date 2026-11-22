/**
 * Mesh Dutch Auction Swap XO Template Blueprint (Future Expansion).
 *
 * Models DutchAuctionSwap.cash / DutchDecayStrategyCovenant.cash
 * into standard XO declarative templates.
 *
 * Lifecycle:
 * - start: Maker locks sell amount with startPrice, endPrice, and auctionDuration.
 * - fill: Solver fills at the linearly decayed price calculated from block time.
 * - cancel: Maker reclaims unsold assets after auction expiry.
 */

import type { XOTemplate } from '../../types';

export const MESH_DUTCH_AUCTION_XO_TEMPLATE: XOTemplate = {
  name: 'Mesh Dutch Auction Swap',
  description:
    'Linear decay Dutch auction covenant on Bitcoin Cash. Price drops linearly over time until filled by a solver or canceled by the maker after expiry.',
  icon: 'trending-down',
  version: '1.0.0',
  supportedVmVersions: ['BCH_2025_05'],
  variables: {
    makerPkh: {
      name: 'Maker PKH',
      description: '20-byte public key hash of the maker',
      type: 'bytes20',
    },
    startPrice: {
      name: 'Start Price',
      description: 'Starting price in satoshis / tokens at auction inception',
      type: 'int',
    },
    endPrice: {
      name: 'Reserve / End Price',
      description: 'Minimum price threshold below which the auction will not decay',
      type: 'int',
    },
    startTime: {
      name: 'Start Time',
      description: 'Unix timestamp marking the beginning of price decay',
      type: 'int',
    },
    duration: {
      name: 'Auction Duration',
      description: 'Duration in seconds over which the price decays to endPrice',
      type: 'int',
    },
  },
  lockingScripts: {
    dutchCovenant: {
      name: 'Dutch Auction Covenant',
      description: 'P2SH32 covenant computing linear price decay on-chain via tx.locktime',
      lockingType: 'p2sh32',
      lockingScript: '/* Compiled DutchAuctionSwap bytecode placeholder */',
      roles: {
        maker: {
          actions: ['cancelEarly', 'cancel'],
        },
        solver: {
          actions: ['fill'],
        },
      },
    },
  },
};
