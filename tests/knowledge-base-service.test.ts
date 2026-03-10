jest.mock('electron', () => ({ app: { getPath: () => '/tmp/arion-test-user-data' } }))
jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }))

import { KnowledgeBaseService } from '../src/main/services/knowledge-base-service'

const mockSettingsService = {
  getEmbeddingConfig: jest
    .fn()
    .mockResolvedValue({ provider: 'openai', model: 'text-embedding-3-small' }),
  getOpenAIConfig: jest.fn().mockResolvedValue({ apiKey: 'abc', model: 'gpt-4o-mini' })
}

describe('KnowledgeBaseService', () => {
  let service: KnowledgeBaseService

  beforeEach(() => {
    service = new KnowledgeBaseService(mockSettingsService as never)
  })

  test('findSimilarChunks parses embedding text into arrays', async () => {
    service['db'] = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            id: 'c1',
            document_id: 'd1',
            content: 'hello',
            created_at: '2026-01-01T00:00:00.000Z',
            embedding_text: '[0.1,0.2,0.3]'
          }
        ]
      })
    } as never

    const result = await service.findSimilarChunks([0.1, 0.2, 0.3], 1)
    expect(result).toHaveLength(1)
    expect(result[0]?.embedding).toEqual([0.1, 0.2, 0.3])
  })

  test('getChunkCount returns parsed count', async () => {
    service['db'] = {
      query: jest.fn().mockResolvedValue({ rows: [{ count: '42' }] })
    } as never

    await expect(service.getChunkCount()).resolves.toBe(42)
  })

  test('getAllKnowledgeBaseDocuments maps file_path to filePath', async () => {
    service['db'] = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            id: 'doc-1',
            name: 'Doc',
            original_file_name: 'doc.txt',
            file_path: '/tmp/doc.txt',
            file_type: 'text/plain',
            file_size: 12,
            folder_id: null,
            description: null,
            chunk_count: 3,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z'
          }
        ]
      })
    } as never

    const docs = await service.getAllKnowledgeBaseDocuments()
    expect(docs[0]?.filePath).toBe('/tmp/doc.txt')
    expect(docs[0]?.chunk_count).toBe(3)
  })
})
