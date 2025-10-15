#!/usr/bin/env node
'use strict'

const { spawnSync } = require('child_process')

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const parseExtraArgs = () => {
  if (process.env.E2E_CYPRESS_ARGS_JSON) {
    try {
      const parsed = JSON.parse(process.env.E2E_CYPRESS_ARGS_JSON)
      if (Array.isArray(parsed)) {
        return parsed.map(String)
      }
    } catch (error) {
      console.warn('[run-cypress-e2e] Failed to parse E2E_CYPRESS_ARGS_JSON:', error.message)
    }
  }

  if (process.env.npm_config_argv) {
    try {
      const parsed = JSON.parse(process.env.npm_config_argv)
      if (parsed && Array.isArray(parsed.remain)) {
        return parsed.remain.map(String)
      }
    } catch (error) {
      console.warn('[run-cypress-e2e] Failed to parse npm_config_argv:', error.message)
    }
  }

  return []
}

const extraArgs = parseExtraArgs()

const env = {
  ...process.env,
  CYPRESS_baseUrl: process.env.CYPRESS_baseUrl || 'http://127.0.0.1:4173',
  CYPRESS_apiUrl: process.env.CYPRESS_apiUrl || 'http://127.0.0.1:3001',
  // Gate provider-keys spec by default to avoid local flakiness unless explicitly enabled
  CYPRESS_RUN_PROVIDER_KEYS: process.env.CYPRESS_RUN_PROVIDER_KEYS || 'false'
}

const npmArgs = ['--prefix', 'frontend', 'run', 'cypress:run']

if (extraArgs.length > 0) {
  npmArgs.push('--', ...extraArgs)
}

const result = spawnSync(npmCmd, npmArgs, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env
})

if (result.error) {
  throw result.error
}

if (typeof result.status === 'number' && result.status !== 0) {
  process.exit(result.status)
}