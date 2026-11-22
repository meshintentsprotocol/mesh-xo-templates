/**
 * Standard XO Template types conforming to @xo-cash/types specifications.
 * These interfaces provide the declarative blueprint for smart contract covenants,
 * actions, roles, and invitation lifecycles on Bitcoin Cash.
 */

export type BchVmVersion = 'BCH_2023_05' | 'BCH_2024_05' | 'BCH_2025_05';

export type LockingType = 'standard' | 'p2sh20' | 'p2sh32';

export interface XOTemplateVariable {
  name: string;
  description: string;
  type: 'bytes' | 'bytes20' | 'bytes32' | 'pubkey' | 'sig' | 'int' | 'string' | 'boolean';
  defaultValue?: unknown;
}

export interface XOTemplateCondition {
  field: string;
  operator: '==' | '!=' | '>=' | '<=' | '>' | '<' | 'includes';
  value: unknown;
}

export interface XOTemplateAction {
  name: string;
  description: string;
  icon?: string;
  roles: Record<string, {
    description?: string;
  }>;
  requirements?: {
    inputs?: Array<{
      description?: string;
      role?: string;
      lockingType?: LockingType;
      satoshis?: bigint | number;
      token?: { category: string; amount: bigint | number };
    }>;
    outputs?: Array<{
      description?: string;
      to?: string;
      satoshis?: bigint | number;
      token?: { category: string; amount: bigint | number };
    }>;
    variables?: string[];
  };
  conditions?: XOTemplateCondition[];
}

export interface XOTemplateLockingScript {
  name: string;
  description: string;
  icon?: string;
  lockingType: LockingType;
  /** CashASM script string or reference to compiled bytecode */
  lockingScript: string;
  /** Follow-up actions and roles that become available once an output is locked here */
  roles?: Record<string, {
    actions: string[];
  }>;
}

export interface XOTemplateUnlockingScript {
  name: string;
  description: string;
  unlockingScript: string;
}

export interface XOTemplateDefaults {
  change?: { templateIdentifier: string };
  receive?: { templateIdentifier: string };
  address?: { templateIdentifier: string };
}

export interface XOTemplate {
  /** Human-readable name of the template */
  name: string;
  /** Detailed description of the workflow */
  description: string;
  /** Visual identifier or icon name */
  icon?: string;
  /** Semantic version of the template specification */
  version: string;
  /** Target Bitcoin Cash VM version (e.g. 'BCH_2025_05') */
  supportedVmVersions: BchVmVersion[];
  
  /** Actions available immediately before holding any output (entry points like open/fund) */
  start?: Record<string, XOTemplateAction>;
  
  /** Declarations of all locking scripts involved in the template */
  lockingScripts: Record<string, XOTemplateLockingScript>;
  
  /** Declarations of unlocking scripts needed to spend outputs */
  unlockingScripts?: Record<string, XOTemplateUnlockingScript>;
  
  /** Dynamic data fields, public keys, or values required by actions */
  variables: Record<string, XOTemplateVariable>;
  
  /** Default policies for change, receive addresses, and general identity */
  defaults?: XOTemplateDefaults;
}

/**
 * Extension interface for Mesh Covenants implementing the XO Standard.
 * Unifies the declarative blueprint with deterministic CashScript / CashASM compilation
 * and WalletConnect / bch_signTransaction adapters.
 */
export interface MeshXOTemplate<TParams, TActions> {
  readonly id: string;
  readonly template: XOTemplate;
  readonly templateIdentifier: string;
  
  /** Computes the P2SH32 locking bytecode from concrete covenant parameters */
  compileLockingBytecode(params: TParams): Uint8Array;
  
  /** Derives CashAddress (chipnet or mainnet) for the covenant instance */
  deriveAddress(params: TParams, network: 'chipnet' | 'mainnet'): string;

  /** Action & invitation builders for this template */
  actions: TActions;
}

/**
 * Standard WalletConnect BCH / bch_signTransaction request payload
 * compatible with bch-intents-wallet-extension.
 */
export interface WalletSignTxRequest {
  transaction: any;
  sourceOutputs: Array<{
    lockingBytecode: Uint8Array;
    valueSatoshis: bigint;
    token?: {
      category: Uint8Array;
      amount: bigint;
      nft?: {
        capability: 'none' | 'mutable' | 'minting';
        commitment: Uint8Array;
      };
    };
    contract?: {
      name: string;
      artifact?: { contractName: string };
      redeemScript: Uint8Array;
      abiFunction?: { name: string; inputs: any[] };
    };
  }>;
  broadcast?: boolean;
  userPrompt?: string;
}
