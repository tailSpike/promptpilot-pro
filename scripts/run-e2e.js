#!/usr/bin/env node
'use strict'

const { spawnSync } = require('child_process')
const path = require('path')
const { startAndTest } = require('start-server-and-test')

const extraArgs = process.argv.slice(2)
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const runCommand = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options
  })

  if (result.error) {
    throw result.error
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status)
  }

  return result
}

try {
  runCommand(npmCmd, ['run', 'build'])
  runCommand(npmCmd, ['run', 'prepare:e2e'])

  if (!process.env.WAIT_ON_TIMEOUT) {
    process.env.WAIT_ON_TIMEOUT = '180000'
  }

  process.env.E2E_CYPRESS_ARGS_JSON = JSON.stringify(extraArgs)

  const nodeExecutable = JSON.stringify(process.execPath)
  const cypressRunner = path.join(__dirname, 'run-cypress-e2e.js')
  const testCommand = `${nodeExecutable} ${JSON.stringify(cypressRunner)}`

  const expectStatus = process.env.START_SERVER_AND_TEST_EXPECT
    ? Number(process.env.START_SERVER_AND_TEST_EXPECT)
    : 200

  if (Number.isNaN(expectStatus)) {
    throw new Error('START_SERVER_AND_TEST_EXPECT must be numeric when provided')
  }

  startAndTest({
    services: [
      { start: 'npm run start:test', url: 'http://127.0.0.1:3001/api/health' },
      {
        start: 'npm run start:frontend:preview',
        url: 'http-get://127.0.0.1:4173'
      }
    ],
    test: `${testCommand}`,
    namedArguments: {
      expect: expectStatus,
      proxyHost: process.env.START_SERVER_AND_TEST_PROXY_HOST,
      proxyPort: process.env.START_SERVER_AND_TEST_PROXY_PORT
        ? Number(process.env.START_SERVER_AND_TEST_PROXY_PORT)
        : undefined,
      proxyProtocol: process.env.START_SERVER_AND_TEST_PROXY_PROTOCOL,
      proxyUser: process.env.START_SERVER_AND_TEST_PROXY_USER,
      proxyPassword: process.env.START_SERVER_AND_TEST_PROXY_PASSWORD
    }
  }).catch(error => {
    console.error(error)
    if (typeof error.code === 'number') {
      process.exit(error.code)
    }
    process.exit(1)
  })
} catch (error) {
  console.error(error)
  if (typeof error.code === 'number') {
    process.exit(error.code)
  }
  process.exit(1)
}