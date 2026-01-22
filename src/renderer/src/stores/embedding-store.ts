/**
 * Embedding Configuration Store
 *
 * Manages embedding provider configuration state in the renderer.
 * Follows the same pattern as llm-store.ts.
 */

import { create } from 'zustand'
import type {
  EmbeddingProviderType,
  EmbeddingConfig,
  EmbeddingStatus
} from '../../../shared/ipc-types'

interface EmbeddingStoreState {
  // Current configuration
  embeddingConfig: EmbeddingConfig | null

  // Status
  status: EmbeddingStatus | null
  isInitialized: boolean
  isLoading: boolean
  error: string | null

  // Actions
  initializeStore: () => Promise<void>
  setEmbeddingConfig: (
    config: EmbeddingConfig
  ) => Promise<{ success: boolean; needsRebuild: boolean; error?: string }>
  refreshStatus: () => Promise<void>
  rebuildEmbeddings: () => Promise<{ success: boolean; error?: string }>

  // Helpers
  isConfigured: () => boolean
  getActiveProvider: () => EmbeddingProviderType | null
  getActiveModel: () => string | null
}

const initialStatus: EmbeddingStatus = {
  ready: false,
  provider: null,
  model: null,
  dimensions: null,
  isRebuilding: false,
  documentCount: 0,
  chunkCount: 0
}

export const useEmbeddingStore = create<EmbeddingStoreState>((set, get) => ({
  embeddingConfig: null,
  status: null,
  isInitialized: false,
  isLoading: false,
  error: null,

  initializeStore: async () => {
    if (get().isInitialized) return

    set({ isLoading: true, error: null })

    try {
      const settings = window.ctg?.settings
      if (settings?.getEmbeddingConfig) {
        const config = await settings.getEmbeddingConfig()
        set({ embeddingConfig: config })
      }

      // Also fetch status
      const kb = window.ctg?.knowledgeBase
      if (kb?.getEmbeddingStatus) {
        const status = await kb.getEmbeddingStatus()
        set({ status })
      }

      set({ isInitialized: true, isLoading: false })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load embedding config'
      set({ error: errorMessage, isLoading: false, isInitialized: true })
    }
  },

  setEmbeddingConfig: async (config) => {
    const oldConfig = get().embeddingConfig
    set({ isLoading: true, error: null })

    try {
      const settings = window.ctg?.settings
      if (!settings?.setEmbeddingConfig) {
        throw new Error('Settings API not available')
      }

      const result = await settings.setEmbeddingConfig(config)

      if (result.success) {
        set({ embeddingConfig: config })

        // Refresh status after config change
        await get().refreshStatus()
      } else {
        set({ error: result.error || 'Failed to save embedding config' })
      }

      set({ isLoading: false })
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save embedding config'
      set({ embeddingConfig: oldConfig, error: errorMessage, isLoading: false })
      return { success: false, needsRebuild: false, error: errorMessage }
    }
  },

  refreshStatus: async () => {
    try {
      const kb = window.ctg?.knowledgeBase
      if (kb?.getEmbeddingStatus) {
        const status = await kb.getEmbeddingStatus()
        set({ status })
      }
    } catch (error) {
      console.error('[EmbeddingStore] Failed to refresh status:', error)
    }
  },

  rebuildEmbeddings: async () => {
    set({ isLoading: true, error: null })

    try {
      const kb = window.ctg?.knowledgeBase
      if (!kb?.rebuildEmbeddings) {
        throw new Error('Knowledge Base API not available')
      }

      const result = await kb.rebuildEmbeddings()

      if (!result.success) {
        set({ error: result.error || 'Failed to rebuild embeddings' })
      }

      // Refresh status after rebuild
      await get().refreshStatus()

      set({ isLoading: false })
      return result
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to rebuild embeddings'
      set({ error: errorMessage, isLoading: false })
      return { success: false, error: errorMessage }
    }
  },

  isConfigured: () => {
    const config = get().embeddingConfig
    return config !== null && !!config.provider && !!config.model
  },

  getActiveProvider: () => {
    return get().embeddingConfig?.provider || null
  },

  getActiveModel: () => {
    return get().embeddingConfig?.model || null
  }
}))
