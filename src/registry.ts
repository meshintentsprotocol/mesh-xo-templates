import type { MeshXOTemplate, XOTemplate } from './types';
import { MeshLimitOrderTemplate } from './templates/limit-order';

/**
 * Central Registry for Mesh XO Templates.
 * Provides lookup, registration, and discovery of templates by semantic ID
 * or content-addressed templateIdentifier.
 */
export class MeshXORegistry {
  private static instance: MeshXORegistry;
  private templatesById = new Map<string, MeshXOTemplate<any, any>>();
  private templatesByIdentifier = new Map<string, MeshXOTemplate<any, any>>();

  private constructor() {
    // Automatically register default benchmark template
    this.register(MeshLimitOrderTemplate);
  }

  public static getInstance(): MeshXORegistry {
    if (!MeshXORegistry.instance) {
      MeshXORegistry.instance = new MeshXORegistry();
    }
    return MeshXORegistry.instance;
  }

  /**
   * Registers a new Mesh XO template into the registry.
   */
  public register<TParams, TActions>(template: MeshXOTemplate<TParams, TActions>): void {
    this.templatesById.set(template.id, template);
    this.templatesByIdentifier.set(template.templateIdentifier, template);
  }

  /**
   * Retrieves a template by its semantic ID (e.g. 'mesh-limit-order-v1')
   * or by its content-addressed templateIdentifier hash.
   */
  public get(idOrIdentifier: string): MeshXOTemplate<any, any> | undefined {
    return this.templatesById.get(idOrIdentifier) || this.templatesByIdentifier.get(idOrIdentifier);
  }

  /**
   * Lists all registered templates.
   */
  public list(): Array<MeshXOTemplate<any, any>> {
    return Array.from(this.templatesById.values());
  }

  /**
   * Returns whether a template is registered.
   */
  public has(idOrIdentifier: string): boolean {
    return this.templatesById.has(idOrIdentifier) || this.templatesByIdentifier.has(idOrIdentifier);
  }
}

/** Global default registry instance */
export const xoRegistry = MeshXORegistry.getInstance();
