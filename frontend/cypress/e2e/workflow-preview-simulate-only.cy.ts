/// <reference types="cypress" />

import { createWorkflowFixture, visitWithAuth, type WorkflowFixture } from '../support/regressionHelpers';

describe('Workflow preview simulate-only mode', () => {
  const backendUrl = () => Cypress.env('apiUrl') as string;
  let fixture: WorkflowFixture;

  before(() => {
    createWorkflowFixture('workflow-preview-sim', {
      workflow: { isActive: true },
    }).then((created) => {
      fixture = created;
      const headers = { Authorization: `Bearer ${fixture.token}` };
      const workflowId = fixture.workflowId;
      const baseUrl = backendUrl();

      // Add a DELAY step that should be skipped (simulated) in preview
      return cy
        .request({
          method: 'POST',
          url: `${baseUrl}/api/workflows/${workflowId}/steps`,
          headers,
          body: {
            name: 'Wait briefly (simulated)',
            type: 'DELAY',
            order: 0,
            config: { delayMs: 2500 },
          },
        })
        .its('status')
        .should('eq', 201)
        .then(() => {
          // Add a PROMPT step with inline content to ensure simulate-only output is generated
          return cy
            .request({
              method: 'POST',
              url: `${baseUrl}/api/workflows/${workflowId}/steps`,
              headers,
              body: {
                name: 'Summarize input',
                type: 'PROMPT',
                order: 1,
                config: {
                  promptContent: 'Summarize: {{text}}',
                  models: [
                    { provider: 'openai', model: 'gpt-4o-mini', label: 'OpenAI' },
                  ],
                },
              },
            })
            .its('status')
            .should('eq', 201)
            .then(() => {
              // Add a DECISION step to finalize output
              return cy
                .request({
                  method: 'POST',
                  url: `${baseUrl}/api/workflows/${workflowId}/steps`,
                  headers,
                  body: {
                    name: 'Review (auto)',
                    type: 'DECISION',
                    order: 2,
                    config: { options: ['approve', 'reject'] },
                  },
                })
                .its('status')
                .should('eq', 201);
            });
        });
    });
  });

  beforeEach(() => {
    visitWithAuth(`/workflows/${fixture.workflowId}`, fixture);
    cy.contains('Execute Workflow', { timeout: 15000 }).should('be.visible');
    cy.get('[data-testid="workflow-preview-results"]').should('not.exist');
  });

  it('shows Simulated badge and skips delay step during preview', () => {
    // Provide manual input to avoid sample data indicator
    cy.get('textarea#input').clear().type('{"text":"Hello world"}', { delay: 0, parseSpecialCharSequences: false });
    cy.get('input[type="checkbox"]').uncheck({ force: true });

    cy.contains('button', 'Preview Workflow').click();

    cy.get('[data-testid="workflow-preview-results"]', { timeout: 15000 }).should('be.visible');
    // Manual input message
    cy.contains('Inputs were provided manually.').should('be.visible');
    // Simulated badge present
    cy.contains('span', 'Simulated').should('be.visible');

    // Step breakdown contains our steps
    cy.contains('Step breakdown').should('be.visible');
    cy.contains('Wait briefly (simulated)').should('exist');
    cy.contains('Summarize input').should('exist');
    cy.contains('Review (auto)').should('exist');

    // Delay step output indicates simulation and includes delayMs
    cy.contains('details', 'Wait briefly (simulated)').within(() => {
      cy.contains('Output').should('be.visible');
      cy.get('pre')
        .eq(1) // second pre within the details (Output)
        .invoke('text')
        .then((text) => {
          expect(text).to.contain('"delayed": true');
          expect(text).to.contain('"simulated": true');
          expect(text).to.match(/"delayMs":\s*2500/);
        });
    });

    // Final output contains the auto-approved decision and echoes some data
    cy.get('[data-testid="workflow-preview-final-output"]').should('contain.text', 'auto-approved');

    // Ensure preview card appears above Execution Reports (check vertical position ordering)
    cy.contains('Test Run Summary')
      .should('exist')
      .then(($preview: JQuery<HTMLElement>) => {
        const el = $preview.get(0) as HTMLElement | undefined;
        expect(el, 'preview element exists').to.not.equal(undefined);
        const previewTop = (el as HTMLElement).getBoundingClientRect().top;
        cy.contains('h2', 'Execution Reports')
          .should('exist')
          .then(($exec: JQuery<HTMLElement>) => {
            const exEl = $exec.get(0) as HTMLElement | undefined;
            expect(exEl, 'execution header exists').to.not.equal(undefined);
            const execTop = (exEl as HTMLElement).getBoundingClientRect().top;
            expect(previewTop).to.be.lessThan(execTop);
          });
      });
  });
});
