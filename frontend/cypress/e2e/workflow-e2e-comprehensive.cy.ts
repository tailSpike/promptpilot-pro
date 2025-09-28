/// <reference types="cypress" />

import { createWorkflowFixture, visitWithAuth, type WorkflowFixture } from '../support/regressionHelpers';

describe('Workflow lifecycle regression', () => {
  const backendUrl = () => Cypress.env('apiUrl') as string;
  let fixture: WorkflowFixture;

  before(() => {
    createWorkflowFixture('workflow-lifecycle').then((created) => {
      fixture = created;
    });
  });

  it('supports create, update, execute, and delete operations end-to-end', () => {
    cy.request({
      method: 'POST',
      url: `${backendUrl()}/api/workflows/${fixture.workflowId}/steps`,
      headers: { Authorization: `Bearer ${fixture.token}` },
      body: {
        name: 'Lifecycle Transform Step',
        type: 'TRANSFORM',
        order: 1,
        config: {
          inputPath: 'input.message',
          outputPath: 'output.message',
          operation: 'uppercase'
        }
      }
    }).its('status').should('eq', 201);

    visitWithAuth(`/workflows/${fixture.workflowId}`, fixture);
    cy.contains('Lifecycle Transform Step', { timeout: 15000 }).should('be.visible');

    cy.request({
      method: 'PUT',
      url: `${backendUrl()}/api/workflows/${fixture.workflowId}`,
      headers: { Authorization: `Bearer ${fixture.token}` },
      body: {
        name: `${fixture.workflowName} - Updated`,
        description: 'Updated workflow description from regression suite'
      }
    })
      .its('status')
      .should('eq', 200);

    cy.request({
      method: 'POST',
      url: `${backendUrl()}/api/workflows/${fixture.workflowId}/execute`,
      headers: { Authorization: `Bearer ${fixture.token}` },
      body: {
        input: { message: 'hello world' },
        triggerType: 'manual'
      }
    })
      .its('status')
      .should('eq', 201);

    cy.request({
      method: 'DELETE',
      url: `${backendUrl()}/api/workflows/${fixture.workflowId}`,
      headers: { Authorization: `Bearer ${fixture.token}` }
    })
      .its('status')
      .should('eq', 200);

    cy.request({
      method: 'GET',
      url: `${backendUrl()}/api/workflows/${fixture.workflowId}`,
      headers: { Authorization: `Bearer ${fixture.token}` },
      failOnStatusCode: false
    })
      .its('status')
      .should('eq', 404);
  });
});