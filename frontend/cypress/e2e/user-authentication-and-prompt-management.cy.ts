/// <reference types="cypress" />

describe('User authentication and prompt management', () => {
  const backendUrl = () => Cypress.env('apiUrl') as string;
  const password = 'promptpass123!';
  const email = `auth-prompt-${Date.now()}@example.com`;
  const name = 'Auth Prompt User';

  before(() => {
    cy.request({
      method: 'POST',
      url: `${backendUrl()}/api/auth/register`,
      body: { name, email, password }
    });
  });

  it('logs in via UI and creates a prompt', () => {
    cy.visit('/login');
    cy.get('input[type="email"]').type(email);
    cy.get('input[type="password"]').type(password);
    cy.get('button[type="submit"]').click();

    cy.url({ timeout: 15000 }).should('include', '/dashboard');

    cy.contains(/prompts/i).click();
    cy.contains(/create.*prompt/i).click();

    cy.get('input#name', { timeout: 15000 }).type('Welcome Prompt');
    cy.get('textarea#description').type('Prompt created via regression suite');
    cy.get('textarea#content').type('Hello {{name}}, welcome to {{company}}!', {
      parseSpecialCharSequences: false
    });

    cy.contains('+ Add').click();
    cy.get('[placeholder="variableName"]').type('name');
    cy.get('select').first().select('text');

    cy.contains('+ Add').click();
    cy.get('[placeholder="variableName"]').eq(1).type('company');

    cy.contains(/create.*prompt/i).click();
    cy.contains(/prompt created successfully/i, { timeout: 15000 }).should('be.visible');
  });
});