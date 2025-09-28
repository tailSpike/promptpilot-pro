/// <reference types="cypress" />

import { createWorkflowFixture, visitWithAuth, type WorkflowFixture } from '../support/regressionHelpers';

describe('Trigger 404 detection', () => {
  const backendUrl = () => Cypress.env('apiUrl') as string;
  let fixture: WorkflowFixture;

  before(() => {
    createWorkflowFixture('trigger-404').then((created) => {
      fixture = created;
    });
  });

  it('performs trigger operations without emitting backend 404 responses', () => {
    const errorResponses: Array<{ method: string; status: number; url: string }> = [];

    cy.intercept(
      { url: `${backendUrl()}/**`, middleware: true },
      (req) => {
        req.on('response', (res) => {
          if (res.statusCode >= 400) {
            errorResponses.push({ method: req.method, status: res.statusCode, url: req.url });
          }
        });
      }
    );

    visitWithAuth(`/workflows/${fixture.workflowId}`, fixture);
    cy.get('[data-testid="workflow-triggers"]', { timeout: 20000 }).should('be.visible');

    cy.contains('Add Trigger').click();
    cy.contains('Create New Trigger').should('be.visible');
    cy.get('input[placeholder="Enter trigger name"]').clear().type('404 Detection Manual Trigger');
    cy.get('[data-testid="trigger-type"]').select('MANUAL');
    cy.intercept('POST', `**/api/workflows/${fixture.workflowId}/triggers`).as('createTrigger');
    cy.contains('Create Trigger').click();
    cy.wait('@createTrigger').its('response.statusCode').should('eq', 201);

    cy.get('[data-testid="trigger-run"]').first().click({ force: true });
    cy.wait(500);
    cy.get('[data-testid="trigger-toggle"]').first().click({ force: true });

    const notFound = errorResponses.filter((entry) => entry.status === 404);
    cy.wrap(notFound).should('have.length', 0);
  });

  it('returns a 404 for unknown trigger ids via API', () => {
    cy.request({
      method: 'GET',
      url: `${backendUrl()}/api/triggers/non-existent-trigger`,
      headers: { Authorization: `Bearer ${fixture.token}` },
      failOnStatusCode: false
    })
      .its('status')
      .should('eq', 404);
  });
});
