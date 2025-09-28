/// <reference types="cypress" />

import { createWorkflowFixture, visitWithAuth, type WorkflowFixture } from '../support/regressionHelpers';

describe('Trigger console hygiene', () => {
  const backendUrl = () => Cypress.env('apiUrl') as string;
  let fixture: WorkflowFixture;

  before(() => {
    createWorkflowFixture('trigger-console').then((created) => {
      fixture = created;

      return cy.request({
        method: 'POST',
        url: `${backendUrl()}/api/workflows/${fixture.workflowId}/triggers`,
        headers: { Authorization: `Bearer ${fixture.token}` },
        body: {
          name: 'Console Inspection Trigger',
          type: 'MANUAL',
          isActive: true,
          config: {}
        }
      });
    });
  });

  it('loads trigger UI without console errors or warnings', () => {
    visitWithAuth(`/workflows/${fixture.workflowId}`, fixture);

    cy.window().then((win) => {
      cy.stub(win.console, 'error').as('consoleError');
      cy.stub(win.console, 'warn').as('consoleWarn');
    });

    cy.get('[data-testid="workflow-triggers"]', { timeout: 20000 }).should('be.visible');

    cy.get('[data-testid="trigger-run"]').first().click({ force: true });
    cy.wait(500);
    cy.get('[data-testid="trigger-toggle"]').first().click({ force: true });
    cy.wait(250);

    const assertNoConsoleNoise = (stub: Cypress.Agent<sinon.SinonStub>) => {
      const messages = stub.getCalls().map((call) => call.args.join(' '));
      const noisy = messages.filter((message) => /error|warning|404|not found/i.test(message));
      expect(noisy, 'console output should remain clean').to.have.length(0);
    };

    cy.get<Cypress.Agent<sinon.SinonStub>>('@consoleError').then(assertNoConsoleNoise);
    cy.get<Cypress.Agent<sinon.SinonStub>>('@consoleWarn').then(assertNoConsoleNoise);
  });
});
