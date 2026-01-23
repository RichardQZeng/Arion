import type { EmbeddingProviderType, EmbeddingModelInfo } from './ipc-types'

/**
 * Shared embedding model definitions for main + renderer.
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