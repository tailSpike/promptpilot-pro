/// <reference types="cypress" />

describe('Workflow Builder V2 - Linear mode (feature flagged)', () => {
  const apiUrl = Cypress.env('apiUrl');
  const unique = Date.now();
  const user = {
    name: `Builder Tester ${unique}`,
    email: `builder${unique}@example.com`,
    password: 'Test1234!'
  };
  let auth: { token: string; user: { id: string; email: string; name: string } };

  before(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    // Ensure backend is up
    cy.request(`${apiUrl}/api/health`).its('status').should('eq', 200);
    // Register
    cy.request('POST', `${apiUrl}/api/auth/register`, user).then((response) => {
      auth = response.body;
    });
  });

  const gotoBuilderV2 = () => {
    cy.visit('/workflows/new', {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', auth.token);
        win.localStorage.setItem('user', JSON.stringify(auth.user));
      },
    });
    // Wait for feature flags and toggle to appear, then enable V2
    cy.get('[data-testid="builder-v2-toggle"]', { timeout: 15000 }).should('be.visible').click({ force: true });
    cy.get('[data-testid="builder-v2-linear"]', { timeout: 10000 }).should('exist');
  };

  const addPromptStep = () => {
    cy.get('[data-testid="add-step"]').click();
    cy.get('[data-testid="step-type-PROMPT"]').click();
    cy.get('[data-testid="step-card"]').should('exist');
  };

  it('exposes Linear Builder route behind feature flag and shows step cards + inspectors', () => {
    gotoBuilderV2();

    // Step card add control
    addPromptStep();

    // Variable Inspector always visible
    cy.get('[data-testid="variable-inspector"]').should('be.visible');
    // Data Inspector drawer
    cy.get('[data-testid="data-inspector-toggle"]').click();
    cy.get('[data-testid="data-inspector"]').should('be.visible');
  });

  it('supports mapping via click-to-bind and validates inline', () => {
    gotoBuilderV2();
    addPromptStep();
    // Select an input on the step
    cy.get('[data-testid="step-card"]').within(() => {
      cy.get('[data-testid="input-field-promptContent"]').click();
    });
    // Click a compatible variable from inspector
    cy.get('[data-testid="variable-item-workflow.input"]').click();
    // Should reflect binding expression and no validation errors
    cy.get('[data-testid="binding-expression"]').should('contain.text', 'workflow.input');
    cy.get('[data-testid="validation-inline"]').should('not.exist');
  });

  it('can Preview with Execution Timeline and run-to-here / re-run controls', () => {
    gotoBuilderV2();
    addPromptStep();
    // Open Preview
    cy.get('[data-testid="preview-run"]').click();
    cy.get('[data-testid="execution-timeline"]').should('be.visible');
    // Run to here
    cy.get('[data-testid="timeline-run-to-here"]').first().click();
    cy.get('[data-testid="execution-timeline-status"]').should('contain.text', 'success');
    // Re-run step
    cy.get('[data-testid="timeline-rerun-step"]').first().click();
    cy.get('[data-testid="execution-timeline-status"]').should('contain.text', 'success');
    // Open Data Inspector and verify sections + Advanced JSON modal
    cy.get('[data-testid="data-inspector-toggle"]').click();
    cy.get('[data-testid="data-inspector"]').within(() => {
      cy.contains('Data Inspector');
      cy.contains('Input (workflow.input)');
      cy.get('[data-testid="data-inspector-input"]').should('exist');
      cy.contains('Additional variables');
      cy.contains('Advanced JSON').click();
    });
    cy.get('[data-testid="data-inspector-advanced-modal"]').should('be.visible');
    cy.contains('Advanced Inputs (JSON)').should('be.visible');
    cy.get('[data-testid="data-inspector-advanced-cancel"]').click();
  });

  it('stays in V2 after Save, binds workflowId so Run is enabled, and uses flat inputs for backend', () => {
    gotoBuilderV2();
    addPromptStep();
    // Open Data inspector and set a custom input + extra variable
    cy.get('[data-testid="data-inspector-toggle"]').click();
    cy.get('[data-testid="data-inspector-input"]').clear().type('CypressUser');
    cy.contains('Add variable').click();
    cy.get('[data-testid="data-inspector"]').within(() => {
      cy.get('[data-testid="data-inspector-var-row"]').within(() => {
        cy.get('input[placeholder="key"]').type('topic');
        cy.get('input[placeholder="value"]').type('Testing');
      });
    });
    // Save workflow
    cy.get('[data-testid="workflow-name-input"]').clear().type(`V2 Flow ${unique}`);
    cy.get('[data-testid="save-workflow"]').click();
    // Should redirect to edit route with v2=1 and expose Run
    cy.url().should('match', /\/workflows\/[^/]+\/edit\?v2=1$/);
    cy.get('[data-testid="builder-v2-linear"]').should('exist');
    cy.get('[data-testid="run-workflow"]').should('be.enabled');
    // Set input again post-redirect, then preview should work and interpolate input
    cy.get('[data-testid="data-inspector-toggle"]').click();
    cy.get('[data-testid="data-inspector-input"]').clear().type('CypressUser');
    cy.get('[data-testid="preview-run"]').click();
    cy.get('[data-testid="execution-timeline"]').should('be.visible');
    cy.get('[data-testid="execution-timeline"]').contains('CypressUser');
  });
});
