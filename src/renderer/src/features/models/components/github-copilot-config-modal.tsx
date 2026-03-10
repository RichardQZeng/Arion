'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { LogIn, Copy, Check, AlertCircle } from 'lucide-react'
import { useLLMStore } from '@/stores/llm-store'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface GitHubCopilotConfigModalProps {
  isOpen: boolean
  onClose: () => void
}

interface DeviceAuthState {
  step: 'idle' | 'requesting' | 'waiting' | 'complete' | 'error'
  deviceCode?: string
  userCode?: string
  verificationUri?: string
  expiresIn?: number
  error?: string
  authToken?: string
}

export default function GitHubCopilotConfigModal({
  isOpen,
  onClose
}: GitHubCopilotConfigModalProps): React.JSX.Element | null {
  const githubCopilotConfig = useLLMStore((state) => state.githubCopilotConfig)
  const setGitHubCopilotConfig = useLLMStore((state) => state.setGitHubCopilotConfig)

  const [model, setModel] = useState('')
  const [enterpriseUrl, setEnterpriseUrl] = useState('')
  const [deviceAuthState, setDeviceAuthState] = useState<DeviceAuthState>({ step: 'idle' })
  const [copied, setCopied] = useState(false)
  const [existingToken, setExistingToken] = useState('')
  const [useExistingAuth, setUseExistingAuth] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setModel(githubCopilotConfig.model || '')
      setEnterpriseUrl(githubCopilotConfig.endpoint || '')
      setExistingToken('')
      setUseExistingAuth(Boolean(githubCopilotConfig.hasApiKey))
      setDeviceAuthState({ step: 'idle' })
      setCopied(false)
      setSaveError(null)
    }
  }, [githubCopilotConfig, isOpen])

  const handleCopyUserCode = (): void => {
    if (deviceAuthState.userCode) {
      navigator.clipboard.writeText(deviceAuthState.userCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const requestDeviceCode = async (): Promise<void> => {
    setDeviceAuthState({ step: 'requesting' })

    try {
      // Call the main process to request device code
      const result = await window.ctg.github.requestDeviceCode()

      if (result.success) {
        setDeviceAuthState({
          step: 'waiting',
          deviceCode: result.deviceCode,
          userCode: result.userCode,
          verificationUri: result.verificationUri,
          expiresIn: result.expiresIn
        })

        // Start polling for authorization
        if (result.deviceCode) {
          pollForAuthorization(result.deviceCode, result.expiresIn || 900)
        }
      } else {
        setDeviceAuthState({
          step: 'error',
          error: result.error || 'Failed to request device code'
        })
      }
    } catch (error) {
      setDeviceAuthState({
        step: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  const pollForAuthorization = async (deviceCode: string, expiresIn: number): Promise<void> => {
    const startTime = Date.now()
    const timeoutMs = expiresIn * 1000
    const pollInterval = 5000 // 5 seconds

    const doPoll = async () => {
      const elapsed = Date.now() - startTime

      if (elapsed > timeoutMs) {
        setDeviceAuthState({
          step: 'error',
          error: 'Device code expired. Please try again.'
        })
        return
      }

      try {
        const result = await window.ctg.github.pollAccessToken(deviceCode)

        if (result.success && result.accessToken) {
          setDeviceAuthState({
            step: 'complete',
            authToken: result.accessToken,
            userCode: deviceAuthState.userCode
          })
          // Transfer the token to the Existing Token tab
          setExistingToken(result.accessToken)
          return
        }

        if (result.error === 'authorization_pending') {
          // Still waiting, poll again
          setTimeout(doPoll, pollInterval)
        } else if (result.error === 'expired_token') {
          setDeviceAuthState({
            step: 'error',
            error: 'Device code expired. Please try again.'
          })
        } else if (result.error) {
          setDeviceAuthState({
            step: 'error',
            error: `GitHub error: ${result.error}`
          })
        } else {
          // No token yet, keep polling
          setTimeout(doPoll, pollInterval)
        }
      } catch (error) {
        // Network error, retry
        setTimeout(doPoll, pollInterval)
      }
    }

    doPoll()
  }

  const handleSaveWithToken = async (token: string): Promise<void> => {
    if (token && model.trim()) {
      try {
        setSaveError(null)
        await setGitHubCopilotConfig({ apiKey: token, model, enterpriseUrl })
        setExistingToken(token)
        setUseExistingAuth(true)
        setTimeout(() => {
          onClose()
        }, 1000)
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Failed to save configuration')
      }
    }
  }

  const handleSaveExisting = async (): Promise<void> => {
    const token = existingToken.trim()
    const hasStoredToken = githubCopilotConfig.hasApiKey === true

    if ((token || hasStoredToken) && model.trim()) {
      try {
        setSaveError(null)
        await setGitHubCopilotConfig({
          apiKey: token || undefined,
          model,
          enterpriseUrl
        })
        onClose()
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Failed to save configuration')
      }
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
              <LogIn className="h-4 w-4 text-primary" />
            </div>
            <DialogTitle className="text-xl">Configure GitHub Copilot</DialogTitle>
          </div>
          <DialogDescription>
            Authenticate using GitHub's device code flow or use an existing token.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Tab-like selector for auth method */}
          <div className="flex gap-2 border-b">
            <button
              onClick={() => {
                setUseExistingAuth(false)
                setDeviceAuthState({ step: 'idle' })
              }}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                !useExistingAuth
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Device Code Flow
            </button>
            <button
              onClick={() => setUseExistingAuth(true)}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                useExistingAuth
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Existing Token
            </button>
          </div>

          {/* Device Code Flow Section */}
          {!useExistingAuth && (
            <div className="space-y-4">
              {deviceAuthState.step === 'idle' && (
                <>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Use GitHub's device code flow for secure authentication. No need to copy-paste
                      tokens.
                    </AlertDescription>
                  </Alert>
                  <Button onClick={requestDeviceCode} className="w-full" size="lg">
                    <LogIn className="mr-2 h-4 w-4" />
                    Start Device Auth Flow
                  </Button>
                </>
              )}

              {deviceAuthState.step === 'requesting' && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                    <p className="text-sm text-muted-foreground">Requesting device code...</p>
                  </div>
                </div>
              )}

              {deviceAuthState.step === 'waiting' && deviceAuthState.userCode && (
                <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
                  <div className="space-y-2">
                    <Label className="font-semibold text-base">Device Code Verification</Label>
                    <p className="text-sm text-muted-foreground">
                      A browser tab will open. If not, visit this URL:
                    </p>
                    <a
                      href={deviceAuthState.verificationUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline break-all"
                    >
                      {deviceAuthState.verificationUri}
                    </a>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-semibold">Enter this code on GitHub:</Label>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-background border rounded-md p-3 font-mono text-lg text-center font-bold tracking-widest">
                        {deviceAuthState.userCode}
                      </div>
                      <Button
                        onClick={handleCopyUserCode}
                        variant="outline"
                        size="sm"
                        className="px-3"
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-center py-4">
                    <div className="text-center">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-2"></div>
                      <p className="text-sm text-muted-foreground">
                        Waiting for authorization... (expires in{' '}
                        {Math.max(0, Math.round((deviceAuthState.expiresIn || 0) / 60))} min)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {deviceAuthState.step === 'complete' && (
                <Alert className="border-green-600/50 bg-green-50 dark:bg-green-950/20">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-900 dark:text-green-200">
                      ✓ Authorization complete! Token received. Now select your model below.
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              {deviceAuthState.step === 'error' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{deviceAuthState.error}</AlertDescription>
                  <Button
                    onClick={requestDeviceCode}
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                  >
                    Try Again
                  </Button>
                </Alert>
              )}
            </div>
          )}

          {/* Existing Token Section */}
          {useExistingAuth && (
            <div className="grid gap-2">
              <Label htmlFor="token" className="font-medium">
                GitHub Token <span className="text-destructive">*</span>
              </Label>
              <Input
                id="token"
                type="password"
                value={existingToken}
                onChange={(e) => setExistingToken(e.target.value)}
                placeholder="ghu_..."
              />
              <p className="text-xs text-muted-foreground">
                Paste your GitHub Copilot token here. Format: <code>ghu_...</code>. Leave blank to
                keep your saved token.
              </p>
              {githubCopilotConfig.hasApiKey && (
                <p className="text-xs text-emerald-600">
                  A token is already saved on this machine.
                </p>
              )}
            </div>
          )}

          {saveError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}

          {/* Model Selection (always visible) */}
          <div className="grid gap-2">
            <Label htmlFor="model" className="font-medium">
              Model <span className="text-destructive">*</span>
            </Label>
            <Input
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g., gpt-4o, gpt-4-turbo"
            />
            <p className="text-xs text-muted-foreground">
              Examples: <code>gpt-4o</code>, <code>gpt-4-turbo</code>,{' '}
              <code>claude-3-5-sonnet</code>
            </p>
          </div>

          {/* Enterprise URL (optional) */}
          <div className="grid gap-2">
            <Label htmlFor="enterpriseUrl" className="font-medium">
              Enterprise URL (optional)
            </Label>
            <Input
              id="enterpriseUrl"
              value={enterpriseUrl}
              onChange={(e) => setEnterpriseUrl(e.target.value)}
              placeholder="https://github.enterprise.com"
            />
            <p className="text-xs text-muted-foreground">
              Only needed for GitHub Enterprise deployments.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {useExistingAuth && (
            <Button
              onClick={handleSaveExisting}
              disabled={
                (!existingToken.trim() && githubCopilotConfig.hasApiKey !== true) || !model.trim()
              }
            >
              Save Configuration
            </Button>
          )}
          {!useExistingAuth && deviceAuthState.step === 'complete' && (
            <Button
              onClick={() => handleSaveWithToken(deviceAuthState.authToken || '')}
              disabled={!model.trim()}
            >
              Save Configuration
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
