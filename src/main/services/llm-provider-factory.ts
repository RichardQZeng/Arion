import { type LanguageModel, simulateStreamingMiddleware, wrapLanguageModel } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAzure } from '@ai-sdk/azure'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createVertex } from '@ai-sdk/google-vertex'
import { createOllama } from '../providers/ollama'
import { SettingsService } from './settings-service'
import { AgentRegistryService } from './agent-registry-service'
import { detectReasoningModel } from './reasoning-model-detector'
import type { ReasoningCapabilityOverride } from '../../shared/utils/model-capabilities'

export interface LLMProviderConfig {
  provider: string
  model: string
  reasoningCapabilityOverride?: ReasoningCapabilityOverride | null
}

export class LLMProviderFactory {
  private settingsService: SettingsService
  private agentRegistryService?: AgentRegistryService

  constructor(settingsService: SettingsService, agentRegistryService?: AgentRegistryService) {
    this.settingsService = settingsService
    this.agentRegistryService = agentRegistryService
  }

  async createLLMFromAgentConfig(agentId?: string): Promise<LanguageModel> {
    const config = await this.getLLMConfig(agentId)
    return this.createLLMFromConfig(config.provider, config.model)
  }

  async getLLMConfig(agentId?: string): Promise<LLMProviderConfig> {
    let provider: string
    let model: string

    if (agentId && this.agentRegistryService) {
      try {
        const agent = await this.agentRegistryService.getAgentById(agentId)
        if (agent?.modelConfig) {
          const modelConfig = agent.modelConfig
          if (!modelConfig.provider || !modelConfig.model) {
            provider = (await this.settingsService.getActiveLLMProvider()) || ''
            model = await this.getGlobalModelForProvider(provider)
          } else {
            provider = modelConfig.provider
            model = modelConfig.model

            const supportedProviders = [
              'openai',
              'google',
              'azure',
              'anthropic',
              'vertex',
              'ollama',
              'github-copilot'
            ]
            if (!supportedProviders.includes(provider.toLowerCase())) {
              provider = (await this.settingsService.getActiveLLMProvider()) || ''
              model = await this.getGlobalModelForProvider(provider)
            }
          }
        } else {
          provider = (await this.settingsService.getActiveLLMProvider()) || ''
          model = await this.getGlobalModelForProvider(provider)
        }
      } catch {
        provider = (await this.settingsService.getActiveLLMProvider()) || ''
        model = await this.getGlobalModelForProvider(provider)
      }
    } else {
      provider = (await this.settingsService.getActiveLLMProvider()) || ''
      model = await this.getGlobalModelForProvider(provider)
    }

    if (!provider) {
      throw new Error('No LLM provider configured (neither agent-specific nor global)')
    }

    if (!model) {
      throw new Error(
        `No LLM model configured for provider '${provider}' (neither agent-specific nor global)`
      )
    }

    let reasoningCapabilityOverride: ReasoningCapabilityOverride | null | undefined = undefined

    if (provider === 'azure') {
      const azureConfig = await this.settingsService.getAzureConfig()
      if (azureConfig?.deploymentName === model) {
        reasoningCapabilityOverride = azureConfig.reasoningCapabilityOverride ?? 'auto'
      }
    }

    return { provider, model, reasoningCapabilityOverride }
  }

  async createLLMFromConfig(provider: string, model: string): Promise<LanguageModel> {
    switch (provider) {
      case 'openai':
        return this.createOpenAILLM(model)
      case 'google':
        return this.createGoogleLLM(model)
      case 'azure':
        return this.createAzureLLM(model)
      case 'anthropic':
        return this.createAnthropicLLM(model)
      case 'vertex':
        return this.createVertexLLM(model)
      case 'ollama':
        return this.createOllamaLLM(model)
      case 'github-copilot':
        return this.createCopilotLLM(model)
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`)
    }
  }

  private async getGlobalModelForProvider(provider: string): Promise<string> {
    switch (provider) {
      case 'openai': {
        const openaiConfig = await this.settingsService.getOpenAIConfig()
        return openaiConfig?.model || ''
      }
      case 'google': {
        const googleConfig = await this.settingsService.getGoogleConfig()
        return googleConfig?.model || ''
      }
      case 'azure': {
        const azureConfig = await this.settingsService.getAzureConfig()
        return azureConfig?.deploymentName || ''
      }
      case 'anthropic': {
        const anthropicConfig = await this.settingsService.getAnthropicConfig()
        return anthropicConfig?.model || ''
      }
      case 'vertex': {
        const vertexConfig = await this.settingsService.getVertexConfig()
        return vertexConfig?.model || ''
      }
      case 'ollama': {
        const ollamaConfig = await this.settingsService.getOllamaConfig()
        return ollamaConfig?.model || ''
      }
      case 'github-copilot': {
        const copilotConfig = await this.settingsService.getGitHubCopilotConfig()
        return copilotConfig?.model || ''
      }
      default:
        return ''
    }
  }

  private async createOpenAILLM(model: string): Promise<LanguageModel> {
    const openaiConfig = await this.settingsService.getOpenAIConfig()
    if (!openaiConfig?.apiKey) {
      throw new Error('OpenAI provider is not configured correctly.')
    }
    const customOpenAI = createOpenAI({ apiKey: openaiConfig.apiKey })
    return customOpenAI(model as Parameters<typeof customOpenAI>[0])
  }

  private async createGoogleLLM(model: string): Promise<LanguageModel> {
    const googleConfig = await this.settingsService.getGoogleConfig()
    if (!googleConfig?.apiKey) {
      throw new Error('Google provider is not configured correctly.')
    }
    const customGoogleProvider = createGoogleGenerativeAI({ apiKey: googleConfig.apiKey })
    return customGoogleProvider(model as Parameters<typeof customGoogleProvider>[0])
  }

  private async createAzureLLM(model: string): Promise<LanguageModel> {
    const azureConfig = await this.settingsService.getAzureConfig()
    if (!azureConfig?.apiKey || !azureConfig.endpoint || !azureConfig.deploymentName) {
      throw new Error('Azure OpenAI provider is not configured correctly.')
    }
    const configuredAzure = createAzure({
      apiKey: azureConfig.apiKey,
      baseURL: azureConfig.endpoint,
      apiVersion: '2024-04-01-preview'
    })
    return configuredAzure.chat(model || azureConfig.deploymentName) as unknown as LanguageModel
  }

  private async createAnthropicLLM(model: string): Promise<LanguageModel> {
    const anthropicConfig = await this.settingsService.getAnthropicConfig()
    if (!anthropicConfig?.apiKey) {
      throw new Error('Anthropic provider is not configured correctly.')
    }
    const customAnthropic = createAnthropic({ apiKey: anthropicConfig.apiKey })
    return customAnthropic.messages(model as Parameters<typeof customAnthropic.messages>[0])
  }

  private async createVertexLLM(model: string): Promise<LanguageModel> {
    const vertexConfig = await this.settingsService.getVertexConfig()
    if (!vertexConfig?.apiKey || !vertexConfig.project || !vertexConfig.location) {
      throw new Error('Vertex AI provider is not configured correctly.')
    }
    let credentialsJson: Record<string, unknown> | undefined = undefined
    try {
      if (vertexConfig.apiKey.trim().startsWith('{')) {
        const parsed = JSON.parse(vertexConfig.apiKey)
        if (parsed && typeof parsed === 'object') {
          credentialsJson = parsed as Record<string, unknown>
        }
      }
    } catch {
      void 0
    }
    const vertexProvider = createVertex({
      ...(credentialsJson ? { googleAuthOptions: { credentials: credentialsJson } } : {}),
      project: vertexConfig.project,
      location: vertexConfig.location
    })
    return vertexProvider(model as Parameters<typeof vertexProvider>[0]) as unknown as LanguageModel
  }

  private async createOllamaLLM(model: string): Promise<LanguageModel> {
    const ollamaConfig = await this.settingsService.getOllamaConfig()
    if (!ollamaConfig?.baseURL) {
      throw new Error('Ollama provider is not configured correctly.')
    }

    let baseURL = ollamaConfig.baseURL.trim()
    baseURL = baseURL.replace(/\/$/, '')
    baseURL = baseURL.replace(/\/api\/?$/, '')

    const ollamaProvider = createOllama({ baseURL })

    const isReasoningModel = detectReasoningModel(model, 'ollama')
    if (!isReasoningModel) {
      return wrapLanguageModel({
        model: ollamaProvider(model as Parameters<typeof ollamaProvider>[0]),
        middleware: simulateStreamingMiddleware()
      })
    }

    return ollamaProvider(model as Parameters<typeof ollamaProvider>[0])
  }

  private async createCopilotLLM(model: string): Promise<LanguageModel> {
    const copilotConfig = await this.settingsService.getGitHubCopilotConfig()
    if (!copilotConfig?.apiKey) {
      throw new Error('GitHub Copilot provider is not configured correctly.')
    }

    const { token: copilotToken, endpoint: apiEndpoint } = await this.getCopilotSessionToken(
      copilotConfig.apiKey,
      copilotConfig.enterpriseUrl || undefined
    )

    const copilotProvider = createOpenAICompatible({
      name: 'github-copilot',
      apiKey: copilotToken,
      baseURL: apiEndpoint,
      headers: {
        'Copilot-Integration-Id': 'vscode-chat',
        'Editor-Version': 'Arion/1.0.0',
        'x-github-api-version': '2025-05-01'
      }
    })

    return copilotProvider.chatModel(model) as LanguageModel
  }

  private async getCopilotSessionToken(
    githubToken: string,
    enterpriseUrl?: string
  ): Promise<{ token: string; endpoint: string }> {
    const https = await import('https')

    let hostname = 'api.github.com'
    if (enterpriseUrl && enterpriseUrl.trim() !== '') {
      try {
        const url = new URL(enterpriseUrl)
        hostname = `api.${url.hostname}`
      } catch {
        void 0
      }
    }

    return new Promise((resolve, reject) => {
      const request = https.request(
        {
          hostname,
          path: '/copilot_internal/v2/token',
          method: 'GET',
          headers: {
            Authorization: `token ${githubToken}`,
            Accept: 'application/json',
            'User-Agent': 'Arion-App',
            'Copilot-Integration-Id': 'vscode-chat',
            'Editor-Version': 'Arion/1.0.0'
          }
        },
        (response) => {
          let body = ''
          response.on('data', (chunk: Buffer) => {
            body += chunk
          })
          response.on('end', () => {
            try {
              if (response.statusCode !== 200) {
                reject(new Error(`Failed to get Copilot token: HTTP ${response.statusCode}`))
                return
              }

              const parsed = JSON.parse(body) as {
                token?: string
                endpoints?: { api?: string }
              }

              if (!parsed.token) {
                reject(new Error('No token in Copilot response'))
                return
              }

              resolve({
                token: parsed.token,
                endpoint: parsed.endpoints?.api || 'https://api.githubcopilot.com'
              })
            } catch (error) {
              reject(
                new Error(
                  `Failed to parse Copilot token response: ${error instanceof Error ? error.message : 'Unknown error'}`
                )
              )
            }
          })
        }
      )

      request.on('error', reject)
      request.end()
    })
  }
}
