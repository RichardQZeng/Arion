// Patch: Mock electron app.getPath for test environment
jest.mock('electron', () => ({ app: { getPath: () => '/tmp/arion-test-user-data' } }))

import { KnowledgeBaseService } from '../src/main/services/knowledge-base-service'

class MockEmbeddingProvider {
  id = 'mock'
  model = 'mock-model'
  get dimensions() {
    return 123
  }
  get maxBatchSize() {
    return 2
  }
  async embedMany(texts: string[]) {
    await new Promise((r) => setTimeout(r, 20))
    return texts.map(() => Array(this.dimensions).fill(0.1))
  }
  async healthCheck() {
    return true
  }
  async dispose() {}
}

const mockSettingsService = {
  getEmbeddingConfig: jest.fn().mockResolvedValue({ provider: 'mock', model: 'mock-model' }),
  getOpenAIConfig: jest.fn().mockResolvedValue({ apiKey: 'abc', model: 'mock-model' })
}

describe('KnowledgeBaseService', () => {
  let service: KnowledgeBaseService
  beforeEach(() => {
    service = new KnowledgeBaseService(mockSettingsService as any)
    service['getOrCreateEmbeddingProvider'] = jest
      .fn()
      .mockResolvedValue(new MockEmbeddingProvider())
    service['db'] = {
      query: jest.fn().mockResolvedValue({ rows: [], affectedRows: 0 })
    } as any
    service['getAllKnowledgeBaseDocuments'] = jest.fn().mockResolvedValue([])
    service['getChunkCount'] = jest.fn().mockResolvedValue(10)
  })

  test('emits progress events on rebuild', async () => {
    let events: any[] = []
    service.onRebuildProgress((e) => events.push(e))
    const docs = Array(4)
      .fill(0)
      .map((_, i) => ({ chunk_id: `id${i}`, content: `text${i}` }))
    service['db'].query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT id as chunk_id')) return { rows: docs }
      if (sql.includes('COMMIT')) return {}
      return {}
    })
    const result = await service.rebuildEmbeddings()
    expect(result.success).toBe(true)
    expect(events.length).toBeGreaterThan(1)
    expect(events[events.length - 1].current).toBe(4)
  })

  test('handles cancellation/graceful interrupt', async () => {
    let events: any[] = []
    service.onRebuildProgress((e) => events.push(e))
    service['getOrCreateEmbeddingProvider'] = jest
      .fn()
      .mockResolvedValue(new MockEmbeddingProvider())
    service['db'].query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT id as chunk_id'))
        return {
          rows: [
            { chunk_id: 'a', content: 'x' },
            { chunk_id: 'b', content: 'y' },
            { chunk_id: 'c', content: 'z' }
          ]
        }
      return {}
    })
    const running = service.rebuildEmbeddings()
    setTimeout(() => {
      service.requestRebuildCancel()
    }, 10)
    const result = await running
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/cancel/i)
  })

  test('denies concurrent rebuild attempts', async () => {
    service['_isRebuilding'] = true
    const result = await service.rebuildEmbeddings()
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/already in progress/)
  })

  test('emits schemaChanged event on dimension change', async () => {
    service['getKbMeta'] = jest.fn().mockResolvedValue('99')
    let schemaChanges: any[] = []
    service['_emitter'].on('schemaChanged', (d) => schemaChanges.push(d))
    service['db'].query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT id as chunk_id')) return { rows: [] }
      return {}
    })
    await service.rebuildEmbeddings()
    expect(schemaChanges.length).toBe(1)
    expect(schemaChanges[0]).toEqual({ from: '99', to: '123' })
  })
})
