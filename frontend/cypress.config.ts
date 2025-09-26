import { defineConfig } from 'cypress'

export default defineConfig({
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
    setupNodeEvents() {
      // implement node event listeners here
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