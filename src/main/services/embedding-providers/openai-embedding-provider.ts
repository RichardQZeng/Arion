/**
 * OpenAI Embedding Provider
 *
 * Uses OpenAI's embedding API via the Vercel AI SDK.
 */

import { embed, embedMany } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import type { EmbeddingModel } from 'ai'
import {
  EmbeddingProvider,
  EmbeddingProviderConfig,
  getModelDimensions
} from './embedding-provider'

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'openai' as const
  readonly model: string
  readonly dimensions: number
  readonly maxBatchSize = 100 // OpenAI supports large batches

  private embeddingModel: EmbeddingModel | undefined
  private apiKey: string

  constructor(config: EmbeddingProviderConfig) {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required')
    }
    this.apiKey = config.apiKey
    this.model = config.model
    this.dimensions = getModelDimensions('openai', config.model)
  }

  async init(): Promise<void> {
    const openai = createOpenAI({ apiKey: this.apiKey })
    this.embeddingModel = openai.embedding(this.model)
  }

  async dispose(): Promise<void> {
    this.embeddingModel = undefined
  }

  async embed(text: string): Promise<number[]> {
    if (!this.embeddingModel) {
      throw new Error('OpenAI embedding model not initialized. Call init() first.')
    }

    const result = await embed({
      model: this.embeddingModel,
      value: text
    })

    return result.embedding
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    if (!this.embeddingModel) {
      throw new Error('OpenAI embedding model not initialized. Call init() first.')
    }

    if (texts.length === 0) {
      return []
    }

    // Process in batches if needed
    const results: number[][] = []
    for (let i = 0; i < texts.length; i += this.maxBatchSize) {
      const batch = texts.slice(i, i + this.maxBatchSize)
      const { embeddings } = await embedMany({
        model: this.embeddingModel,
        values: batch
      })
      results.push(...embeddings)
    }

    return results
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Try to embed a small test string
      await this.embed('test')
      return true
    } catch {
      return false
    }
  }
}
