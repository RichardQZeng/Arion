/**
 * Embedding Provider Interface
 *
 * Defines the contract for all embedding providers (OpenAI, Ollama, transformers.js).
 * Each provider must implement these methods to be used by the KnowledgeBaseService.
 */

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
 * Predefined embedding models per provider.
 */
export const EMBEDDING_MODELS: Record<EmbeddingProviderType, EmbeddingModelInfo[]> = {
  openai: [
    { id: 'text-embedding-3-small', name: 'text-embedding-3-small', dimensions: 1536 },
    { id: 'text-embedding-3-large', name: 'text-embedding-3-large', dimensions: 3072 },
    { id: 'text-embedding-ada-002', name: 'text-embedding-ada-002 (legacy)', dimensions: 1536 }
  ],
  ollama: [
    { id: 'nomic-embed-text', name: 'Nomic Embed Text', dimensions: 768 },
    { id: 'mxbai-embed-large', name: 'mxbai-embed-large', dimensions: 1024 },
    { id: 'all-minilm', name: 'all-minilm', dimensions: 384 },
    { id: 'snowflake-arctic-embed', name: 'Snowflake Arctic Embed', dimensions: 1024 }
  ],
  transformers: [
    { id: 'Xenova/all-MiniLM-L6-v2', name: 'all-MiniLM-L6-v2', dimensions: 384 },
    { id: 'Xenova/bge-small-en-v1.5', name: 'bge-small-en-v1.5', dimensions: 384 },
    { id: 'Xenova/bge-base-en-v1.5', name: 'bge-base-en-v1.5', dimensions: 768 }
  ]
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
