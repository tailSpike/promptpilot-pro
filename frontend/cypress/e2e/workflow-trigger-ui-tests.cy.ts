/// <reference types="cypress" />

import { createWorkflowFixture, visitWithAuth, type WorkflowFixture } from '../support/regressionHelpers';

describe('Workflow trigger UI details', () => {
  const backendUrl = () => Cypress.env('apiUrl') as string;
  let fixture: WorkflowFixture;
  let webhookTriggerId: string;

  before(() => {
    createWorkflowFixture('workflow-trigger-ui').then((created) => {
      fixture = created;

      return cy
        .request({
          method: 'POST',
          url: `${backendUrl()}/api/workflows/${fixture.workflowId}/triggers`,
          headers: { Authorization: `Bearer ${fixture.token}` },
          body: {
            name: 'UI Webhook Trigger',
            type: 'WEBHOOK',
            isActive: true,
            config: {}
          }
        })
        .then((response) => {
          webhookTriggerId = response.body.id as string;
        });
    });
  });

  it('displays webhook trigger metadata in the workflow detail view', () => {
    visitWithAuth(`/workflows/${fixture.workflowId}`, fixture);
    cy.get('[data-testid="workflow-triggers"]', { timeout: 20000 }).should('be.visible');

    cy.contains('UI Webhook Trigger').should('be.visible');
    cy.contains('Webhook URL').should('be.visible');
    cy.contains('/api/webhooks/').should('be.visible');

    cy.request({
      method: 'GET',
      url: `${backendUrl()}/api/triggers/${webhookTriggerId}`,
      headers: { Authorization: `Bearer ${fixture.token}` }
    })
      .its('body.config')
      .should('have.property', 'secret');
  });
});
