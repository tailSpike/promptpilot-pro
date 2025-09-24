/// <reference types="cypress" />

// Custom utility functions for testing
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
    if (response.status === 201) {
      window.localStorage.setItem('token', response.body.token);
      window.localStorage.setItem('user', JSON.stringify(response.body.user));
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
    window.localStorage.setItem('token', response.body.token);
    window.localStorage.setItem('user', JSON.stringify(response.body.user));
    return response;
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

// Export functions for use in tests
(window as unknown as { testUtils: Record<string, unknown> }).testUtils = {
  waitForBackend,
  registerUser,
  loginUser,
  createTestWorkflow,
  createTestTrigger,
  waitForElement
};