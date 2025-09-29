/// <reference types="cypress" />

import { createWorkflowFixture, visitWithAuth, type WorkflowFixture } from '../support/regressionHelpers';

describe('Workflow testing & preview experience', () => {
  const backendUrl = () => Cypress.env('apiUrl') as string;
  let fixture: WorkflowFixture;

  before(() => {
    createWorkflowFixture('workflow-preview', {
      workflow: {
        isActive: true
      }
    }).then((created) => {
      fixture = created;
      const headers = { Authorization: `Bearer ${fixture.token}` };
      const workflowId = fixture.workflowId;
      const baseUrl = backendUrl();

      return cy
        .request({
          method: 'POST',
          url: `${baseUrl}/api/workflows/${workflowId}/steps`,
          headers,
          body: {
            name: 'Set preview status',
            type: 'TRANSFORM',
            order: 0,
            config: {
              transformations: {
                previewStatus: { type: 'concat', values: ['ready'] }
              }
            }
          }
        })
        .its('status')
        .should('eq', 201)
        .then(() => {
          return cy
            .request({
              method: 'POST',
              url: `${baseUrl}/api/workflows/${workflowId}/steps`,
              headers,
              body: {
                name: 'Review result',
                type: 'DECISION',
                order: 1,
                config: {
                  options: ['approve', 'reject']
                }
              }
            })
            .its('status')
            .should('eq', 201);
        });
    });
  });

  beforeEach(() => {
    visitWithAuth(`/workflows/${fixture.workflowId}`, fixture);
    cy.contains('Execute Workflow', { timeout: 15000 }).should('be.visible');
    cy.get('[data-testid="workflow-preview-results"]').should('not.exist');
  });

  it('previews workflow with generated sample data and surfaces step details', () => {
    cy.contains('button', 'Preview Workflow').click();

    cy.get('[data-testid="workflow-preview-results"]', { timeout: 15000 }).should('be.visible');
    cy.contains('Inputs were auto-filled with sample data.').should('be.visible');
  cy.get('[data-testid="workflow-preview-final-output"]').should('contain.text', 'auto-approved');
    cy.contains('Step breakdown').should('be.visible');
    cy.contains('Set preview status').should('exist');
    cy.contains('Review result').should('exist');
  });

  it('accepts manual JSON input and reports manual preview usage', () => {
    const manualInput = '{"customer":"Ava","priority":"high"}';

    cy.get('textarea#input').clear().type(manualInput, { delay: 0, parseSpecialCharSequences: false });
    cy.get('input[type="checkbox"]').uncheck({ force: true });

    cy.contains('button', 'Preview Workflow').click();

    cy.get('[data-testid="workflow-preview-results"]', { timeout: 15000 }).should('be.visible');
    cy.contains('Inputs were provided manually.').should('be.visible');
  cy.get('[data-testid="workflow-preview-final-output"]').should('contain.text', 'Ava');
  cy.get('[data-testid="workflow-preview-final-output"]').should('contain.text', 'auto-approved');

    cy.contains('button', 'Clear preview').click();
    cy.get('[data-testid="workflow-preview-results"]').should('not.exist');
  });

  it('shows validation feedback when JSON input is invalid', () => {
    cy.get('textarea#input').clear().type('{"customer":', { delay: 0, parseSpecialCharSequences: false });
    cy.get('input[type="checkbox"]').uncheck({ force: true });

    cy.contains('button', 'Preview Workflow').click();

    cy.contains('Invalid JSON in input field').should('be.visible');
    cy.get('[data-testid="workflow-preview-results"]').should('not.exist');
  });
});
