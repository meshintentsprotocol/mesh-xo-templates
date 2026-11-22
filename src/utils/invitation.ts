import { binToHex } from '@bitauth/libauth';

/**
 * Standard XO Invitation Schema.
 * Compatible with @xo-cash/engine and the XO Debug Tool (https://stack.xo.cash/tools/debug).
 */
export interface XOInvitation<TParams = Record<string, unknown>> {
  protocol: 'mesh-xo-v1';
  templateIdentifier: string;
  templateName: string;
  intent: string;
  version: string;
  network: 'chipnet' | 'mainnet';
  params: TParams;
  inputs?: Array<{
    outpointTransactionHash: string;
    outpointIndex: number;
    satoshis?: string;
    token?: { category: string; amount: string };
  }>;
  outputs?: Array<{
    lockingBytecode?: string;
    address?: string;
    satoshis: string;
    token?: { category: string; amount: string };
  }>;
  witnessPlaceholders?: Array<{
    inputIndex: number;
    role: string;
    expectedType: 'sig' | 'pubkey';
  }>;
  meta: {
    createdAt: string;
    userPrompt?: string;
  };
}

export function formatXOInvitation<TParams>(
  templateIdentifier: string,
  templateName: string,
  intent: string,
  network: 'chipnet' | 'mainnet',
  params: TParams,
  options?: {
    inputs?: XOInvitation['inputs'];
    outputs?: XOInvitation['outputs'];
    witnessPlaceholders?: XOInvitation['witnessPlaceholders'];
    userPrompt?: string;
  }
): XOInvitation<TParams> {
  return {
    protocol: 'mesh-xo-v1',
    templateIdentifier,
    templateName,
    intent,
    version: '1.0.0',
    network,
    params,
    inputs: options?.inputs,
    outputs: options?.outputs,
    witnessPlaceholders: options?.witnessPlaceholders,
    meta: {
      createdAt: new Date().toISOString(),
      userPrompt: options?.userPrompt,
    },
  };
}

/** Formats an invitation as a pretty-printed JSON string suitable for the debug tool. */
export function stringifyInvitation(invitation: XOInvitation): string {
  return JSON.stringify(
    invitation,
    (_key, value) => {
      if (typeof value === 'bigint') return value.toString();
      if (value instanceof Uint8Array) return `<Uint8Array: 0x${binToHex(value)}>`;
      return value;
    },
    2
  );
}
