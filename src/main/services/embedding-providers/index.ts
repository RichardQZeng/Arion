/**
 * Embedding Providers Module
 *
 * Re-exports all embedding provider related types and functions.
 */

export type {
  EmbeddingProvider,
  EmbeddingProviderConfig,
  EmbeddingProviderType,
  EmbeddingModelInfo
} from './embedding-provider'

export { EMBEDDING_MODELS, getModelDimensions } from './embedding-provider'

export { OpenAIEmbeddingProvider } from './openai-embedding-provider'
export { OllamaEmbeddingProvider } from './ollama-embedding-provider'
export { TransformersEmbeddingProvider } from './transformers-embedding-provider'

export {
  createEmbeddingProvider,
  getDefaultEmbeddingConfig,
  isProviderAvailable
} from './embedding-provider-factory'
