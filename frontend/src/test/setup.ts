import '@testing-library/jest-dom'
import React from 'react'
import { flushSync } from 'react-dom'
import { beforeEach, vi } from 'vitest'

type Thenable<T> = { then: (resolve: (value: T) => void, reject?: (reason: unknown) => void) => void }

declare global {
  // Vitest runs in Node context; declare optional flag used by RTL act polyfill
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

function ensureActImplementation() {
  const currentAct = (React as unknown as { act?: unknown }).act
  if (typeof currentAct === 'function') {
    return currentAct as (cb: () => unknown) => Thenable<unknown>
  }

  const polyfillAct = (callback: () => unknown): Thenable<unknown> => {
    let result: unknown
    let thrown: unknown

    flushSync(() => {
      try {
        result = callback()
      } catch (error) {
        thrown = error
      }
    })

    if (thrown) {
      return {
        then: (_resolve, reject) => {
          if (reject) {
            reject(thrown)
          } else {
            throw thrown
          }
        }
      }
    }

    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      return {
        then: (resolve, reject) => {
          ;(result as PromiseLike<unknown>).then(
            value => queueMicrotask(() => resolve(value)),
            error => {
              if (reject) {
                reject(error)
              } else {
                throw error
              }
            }
          )
        }
      }
    }

    return {
      then: resolve => {
        queueMicrotask(() => resolve(result))
      }
    }
  }

  ;(React as unknown as { act: typeof polyfillAct }).act = polyfillAct
  return polyfillAct
}

ensureActImplementation()

// Explicitly flag act-environment for React Testing Library
if (typeof globalThis.IS_REACT_ACT_ENVIRONMENT === 'undefined') {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
}

// Global test setup
beforeEach(() => {
  // Clear any mocks before each test
  vi.clearAllMocks()
})

// Mock window.matchMedia since JSDOM doesn't implement it
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver since JSDOM doesn't implement it
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock ResizeObserver since JSDOM doesn't implement it  
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))