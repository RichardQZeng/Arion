/**
 * Transformers.js Embedding Provider
 *
 * Uses @xenova/transformers for fully local embedding generation.
 * No API key or external service required.
 *
 * Note: This provider loads models into memory, which can be slow on first use.
 * Models are cached locally after first download.
 */

import {
  EmbeddingProvider,
  EmbeddingProviderConfig,
  getModelDimensions
} from './embedding-provider'

const DEBUG = process.env.NODE_ENV === 'development'
const debugLog = (...args: unknown[]) => {
  if (DEBUG) {
    console.log(...args)
  }
}

// Dynamic import to avoid loading transformers.js until needed
type Pipeline = Awaited<ReturnType<(typeof import('@xenova/transformers'))['pipeline']>>

export class TransformersEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'transformers' as const
  readonly model: string
  readonly dimensions: number
  readonly maxBatchSize = 32 // Balance between speed and memory

  private pipeline: Pipeline | undefined
  private isLoading = false

  constructor(config: EmbeddingProviderConfig) {
    debugLog(
      '[TransformersEmbeddingProvider] Constructor called:',
      config.model || 'Xenova/all-MiniLM-L6-v2'
    )
    this.model = config.model || 'Xenova/all-MiniLM-L6-v2'
    this.dimensions = getModelDimensions('transformers', this.model)
  }

  async init(): Promise<void> {
    if (this.pipeline || this.isLoading) {
      return
    }

    this.isLoading = true
    try {
      debugLog(`[TransformersEmbeddingProvider] Loading model: ${this.model}`)

      // Dynamic import of @xenova/transformers
      const { pipeline } = await import('@xenova/transformers')

      // Set cache directory for models
      // Use app.getPath('userData')/transformers-model-cache for process-safe write
      const { app } = await import('electron')
      const { env } = await import('@xenova/transformers')
      const fs = require('fs')
      const cacheDir = require('path').join(app.getPath('userData'), 'transformers-model-cache')

      // Ensure cache directory exists before setting it
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true })
        debugLog('[TransformersEmbeddingProvider] Created cache directory:', cacheDir)
      }

      env.cacheDir = cacheDir
      debugLog('[TransformersEmbeddingProvider] Using model cache directory:', cacheDir)

      // List cache directory files before pipeline load
      try {
        const files = fs.readdirSync(cacheDir)
        debugLog('[TransformersEmbeddingProvider] Cache contains:', files)
      } catch (e) {
        console.warn('[TransformersEmbeddingProvider] Could not list cache dir:', e)
      }

      try {
        // Create feature-extraction pipeline
        this.pipeline = await pipeline('feature-extraction', this.model, {
          // Use quantized models for faster loading and inference
          quantized: true
        })
        debugLog(`[TransformersEmbeddingProvider] Model loaded: ${this.model}`)
      } catch (error) {
        console.error('[TransformersEmbeddingProvider] Model load error (full object):', error)
        if (error instanceof Error && error.stack) {
          console.error(error.stack)
        }
        throw error
      }
    } catch (error) {
      console.error('[TransformersEmbeddingProvider] Failed to load model:', error)
      throw error
    } finally {
      this.isLoading = false
    }
  }

  async dispose(): Promise<void> {
    if (this.pipeline) {
      // @xenova/transformers pipelines don't have an explicit dispose method
      // but we can clear the reference to allow garbage collection
      this.pipeline = undefined
      debugLog(`[TransformersEmbeddingProvider] Model unloaded: ${this.model}`)
    }
  }

  async embed(text: string): Promise<number[]> {
    const embeddings = await this.embedMany([text])
    return embeddings[0]
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    if (!this.pipeline) {
      await this.init()
    }

    if (!this.pipeline) {
      throw new Error('Transformers pipeline not initialized')
    }

    if (texts.length === 0) {
      return []
    }

    debugLog(`[TransformersEmbeddingProvider] embedMany called with ${texts.length} texts`)
    const results: number[][] = []

    // Process in batches to manage memory
    for (let i = 0; i < texts.length; i += this.maxBatchSize) {
      const batch = texts.slice(i, i + this.maxBatchSize)
      debugLog(
        `[TransformersEmbeddingProvider] Processing batch ${i / this.maxBatchSize + 1}, size: ${batch.length}`
      )

      // transformers.js returns a Tensor object with dims and data
      const output = await (this.pipeline as any)(batch, {
        pooling: 'mean',
        normalize: true
      })

      debugLog(
        `[TransformersEmbeddingProvider] Output type: ${typeof output}, isArray: ${Array.isArray(output)}`
      )
      debugLog(
        `[TransformersEmbeddingProvider] Output keys: ${output ? Object.keys(output) : 'null'}`
      )

      // The output from feature-extraction with pooling is a single Tensor with shape [batch_size, dimensions]
      if (output && output.dims && output.data) {
        const dims = output.dims as number[]
        const data = output.data as Float32Array
        debugLog(
          `[TransformersEmbeddingProvider] Tensor dims: ${JSON.stringify(dims)}, data length: ${data.length}`
        )

        // dims should be [batch_size, embedding_dimensions]
        if (dims.length === 2) {
          const [batchSize, embeddingDim] = dims
          for (let j = 0; j < batchSize; j++) {
            const start = j * embeddingDim
            const end = start + embeddingDim
            results.push(Array.from(data.slice(start, end)))
          }
        } else {
          // Single embedding case (dims might be [1, dimensions] or just [dimensions])
          results.push(Array.from(data))
        }
      } else if (Array.isArray(output)) {
        // Fallback: array of tensors
        for (const tensor of output) {
          if (tensor && tensor.data) {
            results.push(Array.from(tensor.data as Float32Array))
          }
        }
      } else {
        console.error('[TransformersEmbeddingProvider] Unexpected output format:', output)
        throw new Error('Unexpected output format from transformers pipeline')
      }
    }

    debugLog(`[TransformersEmbeddingProvider] embedMany returning ${results.length} embeddings`)
    return results
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.pipeline) {
        // Don't load model just for health check
        // Consider it healthy if we can import transformers
        await import('@xenova/transformers')
        return true
      }
      // If model is loaded, try a quick embed
      await this.embed('test')
      return true
    } catch {
      return false
    }
  }
}
