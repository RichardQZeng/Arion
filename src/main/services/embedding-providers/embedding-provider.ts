/**
 * Embedding Provider Interface
 *
 * Defines the contract for all embedding providers (OpenAI, Ollama, transformers.js).
 * Each provider must implement these methods to be used by the KnowledgeBaseService.
 */

import { EMBEDDING_MODELS } from '../../../shared/embedding-models'

export type EmbeddingProviderType = 'openai' | 'ollama' | 'transformers'

export interface EmbeddingProviderConfig {
  provider: EmbeddingProviderType
  model: string
  baseURL?: string // For Ollama
  apiKey?: string // For OpenAI
}

export interface EmbeddingProvider {
  /** Provider identifier */
  readonly id: EmbeddingProviderType

  /** Model identifier */
  readonly model: string

  /** Vector dimensions for this provider/model combination */
  readonly dimensions: number

  /** Maximum batch size for embedMany calls (for rate limiting) */
  readonly maxBatchSize: number

  /**
   * Initialize the provider (e.g., load transformers.js model).
   * Called once before first use.
   */
  init(): Promise<void>

  /**
   * Dispose of resources (e.g., unload transformers.js model).
   * Called when switching providers.
   */
  dispose(): Promise<void>

  /**
   * Generate embedding for a single text string.
   */
  embed(text: string): Promise<number[]>

  /**
   * Generate embeddings for multiple texts.
   * More efficient than calling embed() multiple times.
   */
  embedMany(texts: string[]): Promise<number[][]>

  /**
   * Check if the provider is properly configured and reachable.
   */
  healthCheck(): Promise<boolean>
}

/**
 * Embedding model information for UI display.
 */
export interface EmbeddingModelInfo {
  id: string
  name: string
  dimensions: number
}

/**
 * Get dimensions for a specific provider/model combination.
 */
export function getModelDimensions(provider: EmbeddingProviderType, modelId: string): number {
  const models = EMBEDDING_MODELS[provider]
  const model = models.find((m) => m.id === modelId)
  if (model) {
    return model.dimensions
  }
  // Default dimensions per provider if model not found
  switch (provider) {
    case 'openai':
      return 1536
    case 'ollama':
      return 768
    case 'transformers':
      return 384
  }
}
