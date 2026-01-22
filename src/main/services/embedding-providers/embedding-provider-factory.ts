/**
 * Embedding Provider Factory
 *
 * Creates the appropriate embedding provider based on configuration.
 */

import {
  EmbeddingProvider,
  EmbeddingProviderConfig,
  EmbeddingProviderType
} from './embedding-provider'
import { OpenAIEmbeddingProvider } from './openai-embedding-provider'
import { OllamaEmbeddingProvider } from './ollama-embedding-provider'
import { TransformersEmbeddingProvider } from './transformers-embedding-provider'

/**
 * Create an embedding provider instance based on configuration.
 *
 * @param config - The embedding provider configuration
 * @returns An initialized embedding provider
 */
export async function createEmbeddingProvider(
  config: EmbeddingProviderConfig
): Promise<EmbeddingProvider> {
  let provider: EmbeddingProvider

  // DEBUG: Log the requested provider config
  console.log('[embedding-provider-factory] Provider requested:', config.provider, config)

  switch (config.provider) {
    case 'openai':
      provider = new OpenAIEmbeddingProvider(config)
      break
    case 'ollama':
      provider = new OllamaEmbeddingProvider(config)
      break
    case 'transformers':
      provider = new TransformersEmbeddingProvider(config)
      break
    default:
      throw new Error(`Unknown embedding provider: ${config.provider}`)
  }

  // DEBUG: About to initialize provider
  console.log('[embedding-provider-factory] About to initialize provider', config.provider)
  await provider.init()

  return provider
}

/**
 * Determine the default embedding provider based on available configurations.
 *
 * Priority:
 * 1. OpenAI (if API key is configured)
 * 2. Ollama (if server is reachable)
 * 3. transformers.js (always available, no external dependencies)
 */
export async function getDefaultEmbeddingConfig(
  openaiApiKey?: string | null,
  ollamaBaseURL?: string | null
): Promise<EmbeddingProviderConfig> {
  // 1. Check OpenAI
  if (openaiApiKey) {
    return {
      provider: 'openai',
      model: 'text-embedding-3-small',
      apiKey: openaiApiKey
    }
  }

  // 2. Check Ollama
  if (ollamaBaseURL) {
    try {
      const response = await fetch(`${ollamaBaseURL}/api/version`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      })
      if (response.ok) {
        return {
          provider: 'ollama',
          model: 'nomic-embed-text',
          baseURL: ollamaBaseURL
        }
      }
    } catch {
      // Ollama not available, continue to fallback
    }
  }

  // 3. Fallback to transformers.js
  return {
    provider: 'transformers',
    model: 'Xenova/all-MiniLM-L6-v2'
  }
}

/**
 * Check if a provider type is available for use.
 */
export async function isProviderAvailable(
  providerType: EmbeddingProviderType,
  config: Partial<EmbeddingProviderConfig>
): Promise<boolean> {
  switch (providerType) {
    case 'openai':
      return !!config.apiKey

    case 'ollama':
      if (!config.baseURL) return false
      try {
        const response = await fetch(`${config.baseURL}/api/version`, {
          method: 'GET',
          signal: AbortSignal.timeout(2000)
        })
        return response.ok
      } catch {
        return false
      }

    case 'transformers':
      // Always available (assuming @xenova/transformers is installed)
      return true

    default:
      return false
  }
}
