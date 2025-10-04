import { defineConfig } from 'cypress'
import { spawn, type ChildProcess } from 'child_process'
import http from 'http'
import https from 'https'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const backendDir = path.join(repoRoot, 'backend')
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const defaultApiUrl = process.env.CYPRESS_apiUrl || 'http://127.0.0.1:3001'
const defaultFrontendUrl = process.env.CYPRESS_baseUrl || 'http://127.0.0.1:5173'

let apiHealthUrl = new URL('/api/health', defaultApiUrl).toString()
let frontendUrl = defaultFrontendUrl

let e2eServersProcess: ChildProcess | null = null
let ensureServersPromise: Promise<void> | null = null

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const pingUrl = (urlString: string): Promise<void> => {
  const url = new URL(urlString)
  const client = url.protocol === 'https:' ? https : http

  return new Promise((resolve, reject) => {
    const request = client.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: 'GET',
        timeout: 5000,
      },
      (response) => {
        response.resume()
        response.on('end', () => {
          const status = response.statusCode ?? 0
          if (status >= 200 && status < 500) {
            resolve()
          } else {
            reject(new Error(`Unexpected status ${status}`))
          }
        })
      },
    )

    request.on('error', reject)
    request.on('timeout', () => {
      request.destroy(new Error('Request timed out'))
    })
    request.end()
  })
}

const waitForServers = async (timeoutMs: number) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await Promise.all([pingUrl(apiHealthUrl), pingUrl(frontendUrl)])
      return
    } catch {
      await wait(1000)
    }
  }
  throw new Error('Timed out waiting for interactive e2e servers to become available')
}

const serversAlreadyRunning = async () => {
  try {
    await waitForServers(2000)
    return true
  } catch {
    return false
  }
}

const runCommand = (args: string[], options: { cwd: string }) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(npmCmd, ['run', ...args], {
      cwd: options.cwd,
      shell: process.platform === 'win32',
      stdio: 'inherit',
      env: process.env,
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command npm run ${args.join(' ')} exited with code ${code}`))
      }
    })
  })

const startInteractiveServers = async () => {
  if (await serversAlreadyRunning()) {
    return
  }

  await runCommand(['db:reset:test'], { cwd: backendDir })

  if (!e2eServersProcess || e2eServersProcess.exitCode !== null) {
    e2eServersProcess = spawn(npmCmd, ['run', 'test:e2e:servers'], {
      cwd: repoRoot,
      shell: process.platform === 'win32',
      stdio: 'inherit',
      env: process.env,
    })

    const proc = e2eServersProcess
    proc.on('exit', () => {
      e2eServersProcess = null
      ensureServersPromise = null
    })
  }

  await waitForServers(120000)
}

const ensureInteractiveServers = () => {
  if (!ensureServersPromise) {
    ensureServersPromise = startInteractiveServers()
  }
  return ensureServersPromise
}

const stopInteractiveServers = () => {
  if (e2eServersProcess && e2eServersProcess.exitCode === null) {
    e2eServersProcess.kill(process.platform === 'win32' ? 'SIGTERM' : 'SIGINT')
  }
}

process.on('exit', stopInteractiveServers)
process.on('SIGINT', () => {
  stopInteractiveServers()
  process.exit(130)
})
process.on('SIGTERM', () => {
  stopInteractiveServers()
  process.exit(143)
})

export default defineConfig({
  // Cypress Cloud project for Dashboard recordings
  projectId: 'r9d8f3',
  retries: {
    // Allow automatic retries to bolster CI stability while keeping interactive runs fast
    runMode: 2,
    openMode: 1,
  },
  e2e: {
    // Environment-aware baseUrl - defaults to dev server, but CI can override
    baseUrl: process.env.CYPRESS_baseUrl || 'http://localhost:5173',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    waitForAnimations: false,
    animationDistanceThreshold: 2,
    chromeWebSecurity: false,
    setupNodeEvents(on, config) {
      if (config?.env?.apiUrl) {
        try {
          apiHealthUrl = new URL('/api/health', config.env.apiUrl).toString()
        } catch (error) {
          console.warn('[cypress.config] Failed to derive API health URL from config.env.apiUrl:', error)
        }
      }

      if (config?.baseUrl) {
        frontendUrl = config.baseUrl
      }

      on('task', {
        async 'e2e:ensureServers'() {
          if (!config.isInteractive) {
            return null
          }

          await ensureInteractiveServers()
          return null
        },
      })

      return config
    },
    env: {
      // Environment-aware API URL - CI uses 5000, local uses 3001
      apiUrl: process.env.CYPRESS_apiUrl || 'http://localhost:3001'
    }
  },
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
    supportFile: 'cypress/support/component.ts',
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
  },
})