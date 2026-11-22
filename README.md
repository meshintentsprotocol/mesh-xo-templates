# Mesh XO Templates (`@mesh/bch-xo-templates`)

Standard XO Templates and WalletConnect / `bch_signTransaction` adapters for Mesh Bitcoin Cash (BCH) Covenants.

[![Test](https://img.shields.io/badge/tests-passing-brightgreen.svg)]()
[![License](https://img.shields.io/badge/license-MIT-blue.svg)]()
[![BCH](https://img.shields.io/badge/network-Bitcoin%20Cash-brightgreen.svg)]()

---

## Overview

The **Mesh XO Templates** package provides declarative, auditable smart contract blueprints conforming to General Protocols' **XO Stack** (`stack.xo.cash`) specifications.

In contrast to traditional EVM blind signing or unstructured transaction approvals, the XO template architecture establishes **Trust-Once-Per-Template** guarantees. Every transaction shape, participant role, UTXO locking script, and condition is declared upfront, allowing non-custodial wallets (such as XO Wallet, CashConnect, or Mesh Extension) to verify transactions against verifiable blueprints before prompting the user.

---

## Features

- **Standard Declarative Schemas**: Full TypeScript typings for `XOTemplate`, `XOTemplateAction`, `XOTemplateRole`, and `XOTemplateLockingScript`.
- **Limit Order Covenant**:
  - Declarative covenant enforcing exact partial or full fills on BCH.
  - Native **CashTokens** (fungible & non-fungible) exchange support.
  - Maker cancellation/refund pathways with timeout or owner pubkey assertion.
  - Automated `bch_signTransaction` adapter for seamless wallet integration.
- **Dutch Auction Covenant**:
  - Time-decay linear auction covenant for tokens and digital assets on BCH.
  - Block/timestamp-based price discovery with deterministic minimum bounds.
- **Mesh Pool Covenant**:
  - Intent-driven AMM pool template with constant-product invariant validation.
- **Central Template Registry (`MeshXORegistry`)**:
  - Content-addressed identification (`templateIdentifier` sha256 hashes).
  - Semantic ID resolution (e.g., `mesh-limit-order-v1`).
- **Utilities & Encoders**:
  - Compact invitation payload serialization (URL-safe base64 / hex).
  - BIP143 / CashTokens introspection helpers.

---

## Directory Structure

```
bch-xo-templates/
├── src/
│   ├── index.ts                     # Main entrypoint
│   ├── types.ts                     # XO Stack & Mesh template interfaces
│   ├── registry.ts                  # MeshXORegistry singleton & discovery
│   ├── utils/
│   │   ├── encoding.ts              # Hex/Base64/Binary utility codecs
│   │   └── invitation.ts            # XO Invitation lifecycle helpers
│   └── templates/
│       ├── limit-order/             # Mesh Limit Order covenant & adapters
│       │   ├── adapter.ts           # Wallet signRequest generation
│       │   ├── builders.ts          # Contract output & action builders
│       │   ├── contract.ts          # CashASM locking script generation
│       │   ├── index.ts             # Template export
│       │   └── template.ts          # XOTemplate declaration
│       ├── dutch-auction/           # Dutch Auction covenant template
│       └── mesh-pool/               # Mesh Liquidity Pool template
└── tests/
    └── limit-order.test.ts          # Vitest unit test suite
```

---

## Installation

```bash
npm install @mesh/bch-xo-templates
```

Or install with yarn/pnpm:

```bash
pnpm add @mesh/bch-xo-templates
```

---

## Quickstart

### 1. Lookup Templates from Registry

```typescript
import { xoRegistry, MeshLimitOrderTemplate } from '@mesh/bch-xo-templates';

// Retrieve registered template
const template = xoRegistry.get('mesh-limit-order-v1');
console.log('Template Name:', template?.name);
console.log('Identifier:', template?.templateIdentifier);
```

### 2. Instantiate a Limit Order Covenant

```typescript
import { MeshLimitOrderTemplate } from '@mesh/bch-xo-templates';

const order = MeshLimitOrderTemplate.createInstance({
  makerPubkey: '02...',
  makerPkh: '...',
  offeredSatoshis: 10000000n, // 0.1 BCH
  demandedSatoshis: 50000000n,
  tokenCategory: '...', // optional CashToken category
  tokenAmount: 0n,
});

// Compile locking bytecode
const lockingScript = order.compileLockingScript();
console.log('Locking Script (Hex):', lockingScript);
```

### 3. Generate `bch_signTransaction` Request for Wallets

```typescript
import { buildLimitOrderSignRequest } from '@mesh/bch-xo-templates';

const signRequest = buildLimitOrderSignRequest({
  orderInstance: order,
  fundingUtxo: {
    txid: 'abc...',
    vout: 0,
    satoshis: 10000000n,
  },
  makerAddress: 'bitcoincash:qp...',
});

// Pass `signRequest` to XO Wallet / Mesh Extension / WalletConnect
```

---

## Development & Testing

```bash
# Install dependencies
npm install

# Run test suite
npm test

# Build package
npm run build
```

---

## Security & Specifications

- Conforms to **General Protocols XO Stack Specification** (`stack.xo.cash`).
- CashTokens support strictly follows **CHIP-2022-02-CashTokens**.
- 32-byte P2SH covenant execution via standard native introspection opcodes (`OP_INPUTINDEX`, `OP_UTXOTOKENCATEGORY`, `OP_OUTPUTBYTECODE`, etc.).

---

## License

MIT © Mesh Intents Protocol
