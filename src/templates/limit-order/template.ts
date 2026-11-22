import { binToHex, hash256, utf8ToBin } from '@bitauth/libauth';
import type { XOTemplate } from '../../types';

/**
 * Standard XO Template Definition for Mesh Limit Order Swap.
 * Conforms to the official @xo-cash/types specification.
 *
 * This document is content-addressed: its SHA-256 hash is its immutable templateIdentifier.
 */
export const MESH_LIMIT_ORDER_XO_TEMPLATE: XOTemplate = {
  name: 'Mesh Limit Order Swap',
  description:
    'Trustless, peer-to-peer fixed-price atomic swap covenant between BCH and CashTokens. Allows anyone to fill before expiry at the fixed price, anyone to refund the maker after expiry, and the maker to cancel early anytime with a digital signature.',
  icon: 'arrow-left-right',
  version: '1.0.0',
  supportedVmVersions: ['BCH_2025_05'],

  variables: {
    makerPkh: {
      name: 'Maker PKH',
      description: '20-byte public key hash of the maker (recipient of buy amount or refund)',
      type: 'bytes20',
    },
    sellTokenCategory: {
      name: 'Sell Token Category',
      description: '32-byte CashToken category ID locked in the order, or 0x for native BCH',
      type: 'bytes',
    },
    buyTokenCategory: {
      name: 'Buy Token Category',
      description: '32-byte CashToken category ID required from resolver, or 0x for native BCH',
      type: 'bytes',
    },
    sellAmount: {
      name: 'Sell Amount',
      description: 'Exact quantity of sell tokens or satoshis locked in covenant',
      type: 'int',
    },
    buyAmount: {
      name: 'Buy Amount',
      description: 'Exact quantity of buy tokens or satoshis required to fill',
      type: 'int',
    },
    expiryTime: {
      name: 'Expiry Time',
      description: 'Unix timestamp after which the order can no longer be filled and can be refunded',
      type: 'int',
    },
    resolverPk: {
      name: 'Resolver Public Key',
      description: 'Compressed public key of the resolver who fills the order',
      type: 'pubkey',
    },
    resolverSig: {
      name: 'Resolver Signature',
      description: 'Cryptographic signature from the resolver authorizing their input',
      type: 'sig',
    },
    makerPk: {
      name: 'Maker Public Key',
      description: 'Compressed public key of the maker authorizing early cancellation',
      type: 'pubkey',
    },
    makerSig: {
      name: 'Maker Signature',
      description: 'Cryptographic signature from the maker authorizing early cancellation',
      type: 'sig',
    },
  },

  start: {
    openOrder: {
      name: 'Open Limit Order',
      description: 'Maker creates and funds the limit order covenant UTXO with the specified sell amount',
      roles: {
        maker: {
          description: 'Owner of the assets being locked at the fixed price',
        },
      },
      requirements: {
        outputs: [
          {
            description: 'Funds locked in the LimitOrderSwap P2SH32 covenant address',
            to: 'covenant',
          },
        ],
        variables: ['makerPkh', 'sellTokenCategory', 'buyTokenCategory', 'sellAmount', 'buyAmount', 'expiryTime'],
      },
    },
  },

  lockingScripts: {
    orderCovenant: {
      name: 'Limit Order Covenant',
      description: 'P2SH32 covenant script enforcing exact payout, price ratio, and authorization constraints',
      lockingType: 'p2sh32',
      lockingScript:
        'OP_6 OP_PICK OP_0 OP_NUMEQUAL OP_IF OP_8 OP_ROLL OP_8 OP_PICK OP_CHECKSIGVERIFY OP_TXINPUTCOUNT OP_2 OP_NUMEQUALVERIFY OP_TXLOCKTIME OP_DUP 0065cd1d OP_GREATERTHANOREQUAL OP_VERIFY OP_6 OP_ROLL OP_LESSTHAN OP_VERIFY 76a914 OP_SWAP OP_CAT 88ac OP_CAT OP_0 OP_OUTPUTBYTECODE OP_EQUALVERIFY OP_OVER OP_0 OP_EQUAL OP_IF OP_0 OP_OUTPUTVALUE OP_4 OP_PICK OP_GREATERTHANOREQUAL OP_VERIFY OP_ELSE OP_0 OP_OUTPUTTOKENCATEGORY OP_2 OP_PICK OP_EQUALVERIFY OP_0 OP_OUTPUTTOKENAMOUNT OP_4 OP_PICK OP_GREATERTHANOREQUAL OP_VERIFY OP_0 OP_OUTPUTVALUE e803 OP_GREATERTHANOREQUAL OP_VERIFY OP_ENDIF OP_5 OP_ROLL OP_HASH160 76a914 OP_SWAP OP_CAT 88ac OP_CAT OP_1 OP_OUTPUTBYTECODE OP_EQUALVERIFY OP_DUP OP_0 OP_EQUAL OP_IF OP_1 OP_OUTPUTVALUE OP_3 OP_PICK OP_GREATERTHANOREQUAL OP_VERIFY OP_ELSE OP_1 OP_OUTPUTTOKENCATEGORY OP_OVER OP_EQUALVERIFY OP_1 OP_OUTPUTTOKENAMOUNT OP_3 OP_PICK OP_GREATERTHANOREQUAL OP_VERIFY OP_ENDIF OP_2DROP OP_2DROP OP_DROP OP_1 OP_ELSE OP_6 OP_PICK OP_1 OP_NUMEQUAL OP_IF OP_5 OP_ROLL OP_CHECKLOCKTIMEVERIFY OP_DROP 76a914 OP_SWAP OP_CAT 88ac OP_CAT OP_0 OP_OUTPUTBYTECODE OP_EQUALVERIFY OP_DUP OP_0 OP_EQUAL OP_IF OP_0 OP_OUTPUTVALUE OP_3 OP_PICK OP_GREATERTHANOREQUAL OP_VERIFY OP_ELSE OP_0 OP_OUTPUTTOKENCATEGORY OP_OVER OP_EQUALVERIFY OP_0 OP_OUTPUTTOKENAMOUNT OP_3 OP_PICK OP_GREATERTHANOREQUAL OP_VERIFY OP_ENDIF OP_2DROP OP_2DROP OP_DROP OP_1 OP_ELSE OP_6 OP_ROLL OP_2 OP_NUMEQUALVERIFY OP_6 OP_PICK OP_HASH160 OP_OVER OP_EQUALVERIFY OP_7 OP_ROLL OP_7 OP_ROLL OP_CHECKSIGVERIFY 76a914 OP_SWAP OP_CAT 88ac OP_CAT OP_0 OP_OUTPUTBYTECODE OP_EQUALVERIFY OP_DUP OP_0 OP_EQUAL OP_IF OP_0 OP_OUTPUTVALUE OP_3 OP_PICK OP_GREATERTHANOREQUAL OP_VERIFY OP_ELSE OP_0 OP_OUTPUTTOKENCATEGORY OP_OVER OP_EQUALVERIFY OP_0 OP_OUTPUTTOKENAMOUNT OP_3 OP_PICK OP_GREATERTHANOREQUAL OP_VERIFY OP_ENDIF OP_2DROP OP_2DROP OP_DROP OP_1 OP_ENDIF OP_ENDIF',
      roles: {
        maker: {
          actions: ['cancelEarly'],
        },
        taker: {
          actions: ['fill'],
        },
        anyone: {
          actions: ['cancel'],
        },
      },
    },
  },

  unlockingScripts: {
    fill: {
      name: 'Fill Limit Order',
      description: 'Resolver supplies buy amount to maker and claims sell amount',
      unlockingScript: '<resolverSig> <resolverPk> OP_0 <redeemScript>',
    },
    cancel: {
      name: 'Cancel Order After Expiry',
      description: 'Permissionless refund sending locked funds back to maker when block time >= expiry',
      unlockingScript: 'OP_1 <redeemScript>',
    },
    cancelEarly: {
      name: 'Cancel Order Early with Maker Signature',
      description: 'Maker-authorized refund allowing maker to back out at any time',
      unlockingScript: '<makerSig> <makerPk> OP_2 <redeemScript>',
    },
  },
};

/**
 * Computes the immutable content-addressed templateIdentifier for an XOTemplate.
 */
export function computeTemplateIdentifier(template: XOTemplate): string {
  const serialized = JSON.stringify(template);
  return binToHex(hash256(utf8ToBin(serialized)));
}
