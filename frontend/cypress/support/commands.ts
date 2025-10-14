/* eslint-disable @typescript-eslint/no-explicit-any */
/// <reference types="cypress" />

// Custom utility functions for testing

// Lightweight Testing Library-style helpers
// Support chaining by scoping to the previous subject when provided
// and default to the document when not. Always prefer a single element by default.
(Cypress.Commands as any).add(
  'findByTestId',
  { prevSubject: 'optional' },
  (subject: JQuery<HTMLElement> | undefined, testId: string, options?: Record<string, unknown>) => {
    if (!testId) {
      throw new Error('findByTestId was called without a testId. Please provide a valid testId string.');
    }
    const selector = `[data-testid="${testId}"]`;
    const opts = { timeout: 10000, ...(options || {}) } as Record<string, unknown>;
    if (subject) {
      return cy.wrap(subject).find(selector, opts).first();
    }
    // Gracefully handle non-existent elements so callers can assert .should('not.exist')
    return cy.get('body').then(($body) => {
      const found = $body.find(selector);
      if (found.length > 0) {
        return cy.get(selector, opts).first();
      }
      // Return empty collection so not.exist assertions pass
      return cy.wrap(found as unknown as JQuery<HTMLElement>);
    });
  }
);

(Cypress.Commands as any).add(
  'findAllByTestId',
  { prevSubject: 'optional' },
  (subject: JQuery<HTMLElement> | undefined, testId: string, options?: Record<string, unknown>) => {
    const selector = `[data-testid="${testId}"]`;
    const opts = { timeout: 10000, ...(options || {}) } as Record<string, unknown>;
    if (subject) {
      return cy.wrap(subject).find(selector, opts);
    }
    return cy.get(selector, opts);
  }
);
function waitForBackend() {
  const apiUrl = Cypress.env('apiUrl');
  
  return cy.request({
    method: 'GET',
    url: `${apiUrl}/api/health`,
    timeout: 30000,
    retryOnStatusCodeFailure: true
  });
}

function registerUser(name: string, email: string, password: string) {
  const apiUrl = Cypress.env('apiUrl');
  
  return cy.request({
    method: 'POST',
    url: `${apiUrl}/api/auth/register`,
    body: { name, email, password },
    failOnStatusCode: false
  }).then((response) => {
    if (response.status === 201 || response.status === 200) {
      // Use cy.window() to ensure proper timing in CI environment
      return cy.window().then((win) => {
        win.localStorage.setItem('token', response.body.token);
        win.localStorage.setItem('user', JSON.stringify(response.body.user));
        return response;
      });
    }
    return response;
  });
}

function loginUser(email: string, password: string) {
  const apiUrl = Cypress.env('apiUrl');
  
  return cy.request({
    method: 'POST',
    url: `${apiUrl}/api/auth/login`,
    body: { email, password }
  }).then((response) => {
    // Use cy.window() to ensure proper timing in CI environment
    return cy.window().then((win) => {
      win.localStorage.setItem('token', response.body.token);
      win.localStorage.setItem('user', JSON.stringify(response.body.user));
      return response;
    });
  });
}

// Add workflow and trigger utilities
function createTestWorkflow(name: string, description: string) {
  const apiUrl = Cypress.env('apiUrl');
  const token = window.localStorage.getItem('token');
  
  return cy.request({
    method: 'POST',
    url: `${apiUrl}/api/workflows`,
    headers: { Authorization: `Bearer ${token}` },
    body: { name, description, isActive: true }
  });
}

function createTestTrigger(workflowId: string, triggerData: Record<string, unknown>) {
  const apiUrl = Cypress.env('apiUrl');
  const token = window.localStorage.getItem('token');
  
  return cy.request({
    method: 'POST',
    url: `${apiUrl}/api/workflows/${workflowId}/triggers`,
    headers: { Authorization: `Bearer ${token}` },
    body: triggerData
  });
}

function waitForElement(selector: string, timeout = 10000) {
  return cy.get(selector, { timeout });
}

// Improved authentication helper
function authenticateAndVisit(url: string, userData?: { token: string; user: unknown }) {
  if (userData) {
    cy.window().then((win) => {
      win.localStorage.setItem('token', userData.token);
      win.localStorage.setItem('user', JSON.stringify(userData.user));
    });
  }
  return cy.visit(url);
}

// Export functions for use in tests
(window as unknown as { testUtils: Record<string, unknown> }).testUtils = {
  waitForBackend,
  registerUser,
  loginUser,
  createTestWorkflow,
  createTestTrigger,
  waitForElement,
  authenticateAndVisit
};