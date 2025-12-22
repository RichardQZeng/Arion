import { ipcMain } from 'electron'
import https from 'https'

const CLIENT_ID = 'Iv1.b507a08c87ecfe98'
const SCOPES = 'gist'

interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

interface TokenResponse {
  access_token?: string
  error?: string
}

/**
 * Make HTTPS request helper
 */
function httpsRequest(
  method: string,
  host: string,
  path: string,
  body?: string
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      path: path,
      method: method,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'arion-github-auth'
      }
    }

    if (body) {
      ;(options.headers as any)['Content-Type'] = 'application/json'
      ;(options.headers as any)['Content-Length'] = Buffer.byteLength(body)
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode || 500,
            data: data ? JSON.parse(data) : null
          })
        } catch (e) {
          resolve({
            status: res.statusCode || 500,
            data: data
          })
        }
      })
    })

    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

/**
 * Register GitHub OAuth handlers
 */
export function registerGitHubHandlers(): void {
  /**
   * Request device code from GitHub
   */
  ipcMain.handle('ctg:github:requestDeviceCode', async () => {
    try {
      const body = JSON.stringify({
        client_id: CLIENT_ID,
        scopes: SCOPES
      })

      const result = await httpsRequest('POST', 'github.com', '/login/device/code', body)

      if (result.status !== 200) {
        throw new Error(`GitHub API error: ${result.status}`)
      }

      const { device_code, user_code, verification_uri, expires_in, interval } = result.data as DeviceCodeResponse

      return {
        success: true,
        deviceCode: device_code,
        userCode: user_code,
        verificationUri: verification_uri,
        expiresIn: expires_in,
        interval: interval || 5
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to request device code'
      }
    }
  })

  /**
   * Poll for access token from GitHub
   */
  ipcMain.handle('ctg:github:pollAccessToken', async (_event, deviceCode: string) => {
    try {
      const body = JSON.stringify({
        client_id: CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      })

      const result = await httpsRequest('POST', 'github.com', '/login/oauth/access_token', body)

      const response = result.data as TokenResponse

      if (response.access_token) {
        return {
          success: true,
          accessToken: response.access_token
        }
      }

      // Handle various error states
      if (response.error === 'authorization_pending') {
        return {
          success: false,
          error: 'authorization_pending'
        }
      }

      if (response.error === 'slow_down') {
        return {
          success: false,
          error: 'slow_down'
        }
      }

      if (response.error === 'expired_token') {
        return {
          success: false,
          error: 'expired_token'
        }
      }

      if (response.error) {
        return {
          success: false,
          error: response.error
        }
      }

      return {
        success: false,
        error: 'No token received'
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to poll access token'
      }
    }
  })
}
