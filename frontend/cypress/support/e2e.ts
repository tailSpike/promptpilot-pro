// Cypress E2E support file
import './commands'

// Hide fetch/XHR requests in command log
const app = window.top;
if (app && !app.document.head.querySelector('[data-hide-command-log-request]')) {
  const style = app.document.createElement('style');
  style.innerHTML = '.command-name-request, .command-name-xhr { display: none }';
  style.setAttribute('data-hide-command-log-request', '');
  app.document.head.appendChild(style);
}

// Global test setup
beforeEach(() => {
  // Intercept all API calls to backend
  cy.intercept('GET', `${Cypress.env('apiUrl')}/**`).as('apiGet');
  cy.intercept('POST', `${Cypress.env('apiUrl')}/**`).as('apiPost');
  cy.intercept('PUT', `${Cypress.env('apiUrl')}/**`).as('apiPut');
  cy.intercept('DELETE', `${Cypress.env('apiUrl')}/**`).as('apiDelete');
});