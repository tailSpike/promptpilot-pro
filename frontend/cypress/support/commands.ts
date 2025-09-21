/// <reference types="cypress" />

// Custom utility functions for testing
function waitForBackend() {
  const apiUrl = Cypress.env('apiUrl');
  
  return cy.request({
    method: 'GET',
    url: `${apiUrl}/health`,
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

// Export functions for use in tests
(window as unknown as { testUtils: Record<string, unknown> }).testUtils = {
  waitForBackend,
  registerUser,
  loginUser
};