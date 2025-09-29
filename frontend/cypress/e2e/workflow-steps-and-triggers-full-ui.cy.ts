/// <reference types="cypress" />

import { createWorkflowFixture, type WorkflowFixture } from '../support/regressionHelpers';

describe('Workflow step type coverage', () => {
  const backendUrl = () => Cypress.env('apiUrl') as string;
  let fixture: WorkflowFixture;

  before(() => {
    createWorkflowFixture('workflow-steps').then((created) => {
      fixture = created;
    });
  });

  it('creates representative steps for each supported type via API', () => {
    const steps = [
      {
        name: 'Prompt Step',
        type: 'PROMPT',
        order: 1,
        config: {
          content: 'Summarise {{topic}}',
          model: 'gpt-4o-mini'
        }
      },
      {
        name: 'Condition Step',
        type: 'CONDITION',
        order: 2,
        config: {
          field: 'input.score',
          operator: 'greater_than',
          value: 50
        }
      },
      {
        name: 'Transform Step',
        type: 'TRANSFORM',
        order: 3,
        config: {
          inputPath: 'input.text',
          outputPath: 'output.text',
          operation: 'lowercase'
        }
      },
      {
        name: 'Delay Step',
        type: 'DELAY',
        order: 4,
        config: {
          duration: 30,
          unit: 'seconds'
        }
      },
      {
        name: 'Webhook Step',
        type: 'WEBHOOK',
        order: 5,
        config: {
          url: 'https://example.com/hook',
          method: 'POST'
        }
      },
      {
        name: 'Decision Step',
        type: 'DECISION',
        order: 6,
        config: {
          defaultChoice: 'fallback'
        }
      }
    ];

    cy.wrap(steps).each((stepPayload) => {
      cy.request({
        method: 'POST',
        url: `${backendUrl()}/api/workflows/${fixture.workflowId}/steps`,
        headers: { Authorization: `Bearer ${fixture.token}` },
        body: stepPayload
      }).its('status').should('eq', 201);
    });

    cy.request({
      method: 'GET',
      url: `${backendUrl()}/api/workflows/${fixture.workflowId}`,
      headers: { Authorization: `Bearer ${fixture.token}` }
    })
      .its('body.steps')
      .should('have.length.greaterThan', 5);
  });
});
