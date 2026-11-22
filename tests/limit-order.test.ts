import { describe, expect, it } from 'vitest';
import {
  binToHex,
  createVirtualMachineBch,
  decodeTransaction,
  encodeLockingBytecodeP2pkh,
  encodeTransaction,
  generateSigningSerializationBch,
  hash160,
  hash256,
  hexToBin,
  secp256k1,
  SigningSerializationFlag,
  type Output,
  type Transaction,
} from '@bitauth/libauth';
import {
  MeshLimitOrderTemplate,
  MESH_LIMIT_ORDER_XO_TEMPLATE,
  computeTemplateIdentifier,
  xoRegistry,
  buildLimitOrderRedeemScript,
  getLimitOrderLockingBytecode,
  getLimitOrderAddress,
  buildCancelEarlyTransaction,
  buildFillTransaction,
  buildCancelTransaction,
  toWalletSignTxRequest,
  formatXOInvitation,
  stringifyInvitation,
} from '../src';

// ── Test Keys ─────────────────────────────────────────────────────────────
const makerPriv = hexToBin('11'.repeat(32));
const makerPub = secp256k1.derivePublicKeyCompressed(makerPriv) as Uint8Array;
const makerPkh = hash160(makerPub);
const makerLocking = encodeLockingBytecodeP2pkh(makerPkh);

const resolverPriv = hexToBin('22'.repeat(32));
const resolverPub = secp256k1.derivePublicKeyCompressed(resolverPriv) as Uint8Array;
const resolverPkh = hash160(resolverPub);
const resolverLocking = encodeLockingBytecodeP2pkh(resolverPkh);

const attackerPriv = hexToBin('33'.repeat(32));
const attackerPub = secp256k1.derivePublicKeyCompressed(attackerPriv) as Uint8Array;

const CAT = 'dfe50223c8d5cba8dcef8dff6d92b61deb88a8ba44947367f2b746487b56039b';

// Helper to sign transactions mimicking the wallet extension's signTransaction
function signWithWalletSigner(
  tx: Transaction,
  sourceOutputs: Output[],
  redeemScript: Uint8Array,
  contractSignerPriv: Uint8Array
): Uint8Array {
  const contractSignerPub = secp256k1.derivePublicKeyCompressed(contractSignerPriv) as Uint8Array;
  const SIG_PLACEHOLDER = Uint8Array.from([0x41, ...new Uint8Array(65)]);

  const signedTx: Transaction = {
    ...tx,
    inputs: tx.inputs.map(input => ({
      ...input,
      unlockingBytecode: input.unlockingBytecode.slice(),
    })),
  };

  // Sign contract input (input 0)
  const flags =
    SigningSerializationFlag.allOutputs |
    SigningSerializationFlag.utxos |
    SigningSerializationFlag.forkId;

  const preimage0 = generateSigningSerializationBch(
    { inputIndex: 0, sourceOutputs, transaction: tx },
    { coveredBytecode: redeemScript, signingSerializationType: Uint8Array.of(flags) }
  );
  const sig0 = secp256k1.signMessageHashSchnorr(contractSignerPriv, hash256(preimage0)) as Uint8Array;
  const fullSig0 = Uint8Array.from([0x41, ...sig0, flags]);

  // Replace placeholder in input 0
  const u0 = signedTx.inputs[0].unlockingBytecode;
  for (let i = 0; i + SIG_PLACEHOLDER.length <= u0.length; i++) {
    let match = true;
    for (let j = 0; j < SIG_PLACEHOLDER.length; j++) {
      if (u0[i + j] !== SIG_PLACEHOLDER[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      u0.set(fullSig0, i);
      break;
    }
  }

  // Sign P2PKH input (input 1) if it's empty
  if (signedTx.inputs.length > 1 && signedTx.inputs[1].unlockingBytecode.length === 0) {
    const p2pkhFlags = SigningSerializationFlag.allOutputs | SigningSerializationFlag.forkId;
    const preimage1 = generateSigningSerializationBch(
      { inputIndex: 1, sourceOutputs, transaction: tx },
      { coveredBytecode: sourceOutputs[1].lockingBytecode, signingSerializationType: Uint8Array.of(p2pkhFlags) }
    );
    const sig1 = secp256k1.signMessageHashSchnorr(contractSignerPriv, hash256(preimage1)) as Uint8Array;
    signedTx.inputs[1].unlockingBytecode = Uint8Array.from([
      0x41,
      ...sig1,
      p2pkhFlags,
      0x21,
      ...contractSignerPub,
    ]);
  }

  return encodeTransaction(signedTx);
}

describe('Mesh XO Limit Order Template Suite', () => {
  const EXPIRY = 1750000000n; // Future unix timestamp
  const orderParams = {
    makerPkh,
    sellTokenCategory: '0x', // selling BCH
    buyTokenCategory: CAT,   // buying PUSD CashToken
    sellAmount: 50_000n,
    buyAmount: 10_000n,
    expiryTime: EXPIRY,
  };

  it('declares a valid XOTemplate with content-addressed templateIdentifier', () => {
    const templateId = computeTemplateIdentifier(MESH_LIMIT_ORDER_XO_TEMPLATE);
    expect(templateId).toBeTypeOf('string');
    expect(templateId.length).toBe(64);
    expect(MeshLimitOrderTemplate.id).toBe('mesh-limit-order-v1');
    expect(MeshLimitOrderTemplate.templateIdentifier).toBe(templateId);

    // Verify registry discovery
    const fromRegistry = xoRegistry.get('mesh-limit-order-v1');
    expect(fromRegistry).toBeDefined();
    expect(fromRegistry?.templateIdentifier).toBe(templateId);
  });

  it('compiles deterministic P2SH32 locking bytecode and address', () => {
    const locking = getLimitOrderLockingBytecode(orderParams);
    expect(locking.length).toBe(35); // 0xaa 0x20 <32-byte-hash> 0x87
    expect(locking[0]).toBe(0xaa);
    expect(locking[1]).toBe(0x20);
    expect(locking[34]).toBe(0x87);

    const address = getLimitOrderAddress(orderParams, 'chipnet');
    expect(address.startsWith('bchtest:p')).toBe(true);
  });

  describe('Lifecycle Action 1: cancelEarly (Maker-Authorized Refund)', () => {
    it('executes cancelEarly successfully when signed by maker', () => {
      const orderUtxo = {
        txid: '01'.repeat(32),
        vout: 0,
        satoshis: 50_000n,
      };
      const feeUtxo = {
        txid: '02'.repeat(32),
        vout: 0,
        satoshis: 10_000n,
      };

      const { transaction, sourceOutputs, redeemScript } = buildCancelEarlyTransaction({
        orderParams,
        orderUtxo,
        feeUtxo,
        makerPk: makerPub,
        makerPkh,
        feePkh: makerPkh,
        feeSatoshis: 1500n,
      });

      // Format as WalletConnect / bch_signTransaction request
      const signRequest = toWalletSignTxRequest({
        transaction,
        sourceOutputs,
        redeemScript,
        broadcast: false,
        userPrompt: 'Cancel Order Early and Reclaim 50,000 sats',
      });
      expect(signRequest.sourceOutputs[0].contract).toBeDefined();
      expect(signRequest.sourceOutputs[0].contract?.name).toBe('LimitOrderSwap');

      // Sign using the wallet signing logic
      const signedBytes = signWithWalletSigner(transaction, sourceOutputs, redeemScript, makerPriv);

      // Verify on the real Bitcoin Cash Virtual Machine
      const decoded = decodeTransaction(signedBytes);
      expect(typeof decoded).not.toBe('string');

      const vmResult = createVirtualMachineBch(false).verify({
        sourceOutputs,
        transaction: decoded as Transaction,
      });
      expect(vmResult).toBe(true);
    });

    it('rejects cancelEarly when signed by an unauthorized party (attacker)', () => {
      const orderUtxo = {
        txid: '01'.repeat(32),
        vout: 0,
        satoshis: 50_000n,
      };
      const feeUtxo = {
        txid: '02'.repeat(32),
        vout: 0,
        satoshis: 10_000n,
      };

      const { transaction, sourceOutputs, redeemScript } = buildCancelEarlyTransaction({
        orderParams,
        orderUtxo,
        feeUtxo,
        makerPk: attackerPub, // Attacker passes their own pubkey
        makerPkh,
        feePkh: hash160(attackerPub),
      });

      const signedBytes = signWithWalletSigner(transaction, sourceOutputs, redeemScript, attackerPriv);
      const decoded = decodeTransaction(signedBytes) as Transaction;

      // Attacker pubkey hash does not match makerPkh -> VM must reject!
      const vmResult = createVirtualMachineBch(false).verify({
        sourceOutputs,
        transaction: decoded,
      });
      expect(vmResult).not.toBe(true);
    });
  });

  describe('Lifecycle Action 2: fill (Resolver Fixed-Price Fulfillment)', () => {
    it('executes fill successfully when resolver provides exact buy token requirements', () => {
      const orderUtxo = {
        txid: '01'.repeat(32),
        vout: 0,
        satoshis: 50_000n,
      };
      const resolverUtxo = {
        txid: '03'.repeat(32),
        vout: 0,
        satoshis: 30_000n,
        token: {
          category: CAT,
          amount: 10_000n,
        },
      };

      const currentTime = 1710000000; // Well before EXPIRY (1750000000) and >= 500000000

      const { transaction, sourceOutputs, redeemScript } = buildFillTransaction({
        orderParams,
        orderUtxo,
        resolverUtxo,
        resolverPk: resolverPub,
        resolverPkh,
        makerPkh,
        currentTime,
        feeSatoshis: 1500n,
      });

      const signedBytes = signWithWalletSigner(transaction, sourceOutputs, redeemScript, resolverPriv);
      const decoded = decodeTransaction(signedBytes) as Transaction;

      const vmResult = createVirtualMachineBch(false).verify({
        sourceOutputs,
        transaction: decoded,
      });
      expect(vmResult).toBe(true);
    });

    it('rejects fill when resolver underpays required buy amount', () => {
      const orderUtxo = {
        txid: '01'.repeat(32),
        vout: 0,
        satoshis: 50_000n,
      };
      const resolverUtxo = {
        txid: '03'.repeat(32),
        vout: 0,
        satoshis: 30_000n,
        token: {
          category: CAT,
          amount: 5_000n, // Underpayment: only 5,000 instead of 10,000
        },
      };

      const currentTime = 1710000000;

      const { transaction, sourceOutputs, redeemScript } = buildFillTransaction({
        orderParams: { ...orderParams, buyAmount: 10_000n },
        orderUtxo,
        resolverUtxo,
        resolverPk: resolverPub,
        resolverPkh,
        makerPkh,
        currentTime,
      });

      // Mutate output 0 to only give 5,000 tokens
      transaction.outputs[0].token!.amount = 5_000n;

      const signedBytes = signWithWalletSigner(transaction, sourceOutputs, redeemScript, resolverPriv);
      const decoded = decodeTransaction(signedBytes) as Transaction;

      const vmResult = createVirtualMachineBch(false).verify({
        sourceOutputs,
        transaction: decoded,
      });
      expect(vmResult).not.toBe(true);
    });
  });

  describe('Lifecycle Action 3: cancel (Permissionless Post-Expiry Refund)', () => {
    it('executes cancel successfully after expiry time has passed', () => {
      const orderUtxo = {
        txid: '01'.repeat(32),
        vout: 0,
        satoshis: 50_000n,
      };
      const feeUtxo = {
        txid: '04'.repeat(32),
        vout: 0,
        satoshis: 10_000n,
      };

      const locktime = Number(EXPIRY) + 100; // Passed expiry

      const { transaction, sourceOutputs } = buildCancelTransaction({
        orderParams,
        orderUtxo,
        feeUtxo,
        makerPkh,
        feePkh: resolverPkh,
        locktime,
        feeSatoshis: 1500n,
      });

      // Sign the fee input (input 1)
      const p2pkhFlags = SigningSerializationFlag.allOutputs | SigningSerializationFlag.forkId;
      const preimage1 = generateSigningSerializationBch(
        { inputIndex: 1, sourceOutputs, transaction },
        { coveredBytecode: sourceOutputs[1].lockingBytecode, signingSerializationType: Uint8Array.of(p2pkhFlags) }
      );
      const sig1 = secp256k1.signMessageHashSchnorr(resolverPriv, hash256(preimage1)) as Uint8Array;
      transaction.inputs[1].unlockingBytecode = Uint8Array.from([
        0x41,
        ...sig1,
        p2pkhFlags,
        0x21,
        ...resolverPub,
      ]);

      const signedBytes = encodeTransaction(transaction);
      const decoded = decodeTransaction(signedBytes) as Transaction;

      const vmResult = createVirtualMachineBch(false).verify({
        sourceOutputs,
        transaction: decoded,
      });
      expect(vmResult).toBe(true);
    });

    it('rejects cancel before expiry time has elapsed', () => {
      const orderUtxo = {
        txid: '01'.repeat(32),
        vout: 0,
        satoshis: 50_000n,
      };
      const feeUtxo = {
        txid: '04'.repeat(32),
        vout: 0,
        satoshis: 10_000n,
      };

      expect(() =>
        buildCancelTransaction({
          orderParams,
          orderUtxo,
          feeUtxo,
          makerPkh,
          feePkh: resolverPkh,
          locktime: Number(EXPIRY) - 100, // Premature
        })
      ).toThrow(/must be >= expiryTime/);
    });
  });

  describe('XO Invitation Formatter & Debug Tool Compatibility', () => {
    it('generates an inspectable XO Invitation JSON object', () => {
      const invitation = formatXOInvitation(
        MeshLimitOrderTemplate.templateIdentifier,
        MeshLimitOrderTemplate.template.name,
        'cancelEarly',
        'chipnet',
        orderParams,
        {
          userPrompt: 'Maker early cancellation of Limit Order',
          witnessPlaceholders: [
            {
              inputIndex: 0,
              role: 'maker',
              expectedType: 'sig',
            },
          ],
        }
      );

      expect(invitation.protocol).toBe('mesh-xo-v1');
      expect(invitation.intent).toBe('cancelEarly');
      expect(invitation.network).toBe('chipnet');
      expect(invitation.params.sellAmount).toBe(50_000n);

      const json = stringifyInvitation(invitation);
      expect(json).toContain('"protocol": "mesh-xo-v1"');
      expect(json).toContain('"templateIdentifier"');
      expect(json).toContain('"sellAmount": "50000"');
    });
  });
});
