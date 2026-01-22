/**
 * Ollama Embedding Provider
 *
 * Uses Ollama's local embedding API via HTTP requests.
 * Ollama must be running locally or accessible via the configured baseURL.
 */

import {
  EmbeddingProvider,
  EmbeddingProviderConfig,
  getModelDimensions
} from './embedding-provider'

interface OllamaEmbedResponse {
  embeddings: number[][]
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'ollama' as const
  readonly model: string
  readonly dimensions: number
  readonly maxBatchSize = 10 // Ollama is typically slower, use smaller batches

  private baseURL: string

  constructor(config: EmbeddingProviderConfig) {
    this.baseURL = config.baseURL || 'http://localhost:11434'
    // Remove trailing slash if present
    if (this.baseURL.endsWith('/')) {
      this.baseURL = this.baseURL.slice(0, -1)
    }
    this.model = config.model
    this.dimensions = getModelDimensions('ollama', config.model)
  }

  async init(): Promise<void> {
    // Ollama doesn't require initialization, but we can verify connectivity
    const isHealthy = await this.healthCheck()
    if (!isHealthy) {
      console.warn('[OllamaEmbeddingProvider] Ollama server not reachable at', this.baseURL)
    }
  }

  async dispose(): Promise<void> {
    // Nothing to dispose for HTTP-based provider
  }

  async embed(text: string): Promise<number[]> {
    const embeddings = await this.embedMany([text])
    return embeddings[0]
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return []
    }

    const results: number[][] = []

    // Process in batches
    for (let i = 0; i < texts.length; i += this.maxBatchSize) {
      const batch = texts.slice(i, i + this.maxBatchSize)

      // Ollama's /api/embed endpoint can handle multiple texts
      const response = await fetch(`${this.baseURL}/api/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          input: batch
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Ollama embedding failed: ${response.status} ${errorText}`)
      }

      const data = (await response.json()) as OllamaEmbedResponse

      if (!data.embeddings || !Array.isArray(data.embeddings)) {
        throw new Error('Invalid response from Ollama: missing embeddings array')
      }

      results.push(...data.embeddings)
    }

    return results
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check if Ollama is running by hitting the version endpoint
      const response = await fetch(`${this.baseURL}/api/version`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Fetch available models from Ollama.
   * Useful for populating model selection in UI.
   */
  static async fetchAvailableModels(
    baseURL: string = 'http://localhost:11434'
  ): Promise<string[]> {
    try {
      const response = await fetch(`${baseURL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })

      if (!response.ok) {
        return []
      }

      const data = (await response.json()) as { models: { name: string }[] }
      // Filter for embedding-capable models (heuristic: contains 'embed' in name)
      return data.models
        .map((m) => m.name)
        .filter(
          (name) =>
            name.includes('embed') ||
            name.includes('nomic') ||
            name.includes('mxbai') ||
            name.includes('minilm')
        )
    } catch {
      return []
    }
  }
}
