/**
 * Embedding Provider Constants for UI
 */

import type { EmbeddingProviderType, EmbeddingModelInfo } from '../../../shared/ipc-types'

// Import logos (reuse existing where possible)
import openaiLogo from '@/assets/llm-providers-logos/openai.svg'
import ollamaLogo from '@/assets/llm-providers-logos/ollama.svg'

// Placeholder for transformers.js logo - using a generic CPU/local icon
// You may want to add a proper transformers.js logo to assets
const transformersLogo = ollamaLogo // Temporary placeholder

export const EMBEDDING_PROVIDER_LOGOS: Record<EmbeddingProviderType, string> = {
  openai: openaiLogo,
  ollama: ollamaLogo,
  transformers: transformersLogo
}

export const EMBEDDING_PROVIDER_BACKGROUNDS: Record<EmbeddingProviderType, string> = {
  openai: 'bg-primary/10',
  ollama: 'bg-gray-100',
  transformers: 'bg-purple-50'
}

export const EMBEDDING_PROVIDER_PROGRESS_COLORS: Record<EmbeddingProviderType, string> = {
  openai: 'bg-primary',
  ollama: 'bg-gray-600',
  transformers: 'bg-purple-600'
}

export const EMBEDDING_PROVIDER_NAMES: Record<EmbeddingProviderType, string> = {
  openai: 'OpenAI',
  ollama: 'Ollama',
  transformers: 'Local (transformers.js)'
}

export const EMBEDDING_PROVIDER_DESCRIPTIONS: Record<EmbeddingProviderType, string> = {
  openai: 'Cloud-based, fast, requires API key',
  ollama: 'Local, requires Ollama running',
  transformers: 'Fully local, no external dependencies'
}

/**
 * Predefined embedding models per provider.
 * This mirrors the server-side EMBEDDING_MODELS constant.
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

export const SUPPORTED_EMBEDDING_PROVIDERS: EmbeddingProviderType[] = [
  'openai',
  'ollama',
  'transformers'
]

/**
 * Get dimensions for a specific provider/model combination.
 */
export function getEmbeddingModelDimensions(
  provider: EmbeddingProviderType,
  modelId: string
): number {
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
