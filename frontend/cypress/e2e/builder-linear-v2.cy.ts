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

  it('supports inserting variable tokens into prompt content and validates inline', () => {
    gotoBuilderV2();
    addPromptStep();
    // Select an input on the step
    cy.get('[data-testid="step-card"]').within(() => {
      cy.get('[data-testid="input-field-promptContent"]').click();
    });
    // Click a compatible variable from inspector (inserts token into prompt content)
    cy.get('[data-testid="variable-item-workflow.input"]').click();
    // Should insert token into input field and no validation errors
    cy.get('[data-testid="input-field-promptContent"]').should('contain.value', '{{workflow.input}}');
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

  it('persists a bound variable in step config after Save and reload', () => {
    gotoBuilderV2();
    addPromptStep();
    // Insert workflow.input token into the step
    cy.get('[data-testid="step-card"]').within(() => {
      cy.get('[data-testid="input-field-promptContent"]').click();
    });
    cy.get('[data-testid="variable-item-workflow.input"]').click();
    cy.get('[data-testid="input-field-promptContent"]').should('contain.value', '{{workflow.input}}');
    // Save workflow
    cy.get('[data-testid="workflow-name-input"]').clear().type(`V2 Binding Persist ${unique}`);
    cy.get('[data-testid="save-workflow"]').click();
    // After redirect, ensure V2 active and binding is still visible
    cy.url().should('match', /\/workflows\/[^/]+\/edit\?v2=1$/);
    cy.get('[data-testid="builder-v2-linear"]').should('exist');
    cy.get('[data-testid="step-card"]').first().within(() => {
      cy.get('[data-testid="input-field-promptContent"]').should('contain.value', '{{workflow.input}}');
    });
  });

  it('persists Additional variables on Save and hydrates them on reload', () => {
    gotoBuilderV2();
    addPromptStep();
    // Open Data inspector and add an Additional variable
    cy.get('[data-testid="data-inspector-toggle"]').click();
    cy.get('[data-testid="data-inspector-input"]').clear().type('World');
    cy.contains('Add variable').click();
    cy.get('[data-testid="data-inspector"]').within(() => {
      cy.get('[data-testid="data-inspector-var-row"]').within(() => {
        cy.get('input[placeholder="key"]').type('feeling');
        cy.get('input[placeholder="value"]').type('pensive');
      });
    });
    // Save workflow
    cy.get('[data-testid="workflow-name-input"]').clear().type(`V2 Vars Persist ${unique}`);
    cy.get('[data-testid="save-workflow"]').click();
    // After redirect, V2 active
    cy.url().should('match', /\/workflows\/[^/]+\/edit\?v2=1$/);
    cy.get('[data-testid="builder-v2-linear"]').should('exist');
    // Variable inspector should list workflow.feeling
    cy.get('[data-testid="variable-inspector"]').contains('workflow.feeling');
    // Data Inspector row should hydrate with feeling=pensive
    cy.get('[data-testid="data-inspector-toggle"]').click();
    cy.get('[data-testid="data-inspector"]').within(() => {
      cy.get('[data-testid="data-inspector-var-row"]').within(() => {
        cy.get('input[placeholder="key"]').should('have.value', 'feeling');
        cy.get('input[placeholder="value"]').should('have.value', 'pensive');
      });
    });
  });

  it('removes deleted Additional variables on Save and hydration reflects removal', () => {
    gotoBuilderV2();
    addPromptStep();
    // Add two variables
    cy.get('[data-testid="data-inspector-toggle"]').click();
    cy.get('[data-testid="data-inspector-input"]').clear().type('World');
    cy.contains('Add variable').click();
    cy.get('[data-testid="data-inspector"]').within(() => {
      cy.get('[data-testid="data-inspector-var-row"]').eq(0).within(() => {
        cy.get('input[placeholder="key"]').type('feeling');
        cy.get('input[placeholder="value"]').type('pensive');
      });
    });
    cy.contains('Add variable').click();
    cy.get('[data-testid="data-inspector"]').within(() => {
      cy.get('[data-testid="data-inspector-var-row"]').eq(1).within(() => {
        cy.get('input[placeholder="key"]').type('topic');
        cy.get('input[placeholder="value"]').type('Testing');
      });
    });
    // Save once with both variables
    cy.get('[data-testid="workflow-name-input"]').clear().type(`V2 Vars Delete ${unique}`);
    cy.get('[data-testid="save-workflow"]').click();
    cy.url().should('match', /\/workflows\/[^/]+\/edit\?v2=1$/);
    cy.get('[data-testid="variable-inspector"]').within(() => {
      cy.get('[data-testid="variable-item-workflow.feeling"]').should('exist');
      cy.get('[data-testid="variable-item-workflow.topic"]').should('exist');
    });
    // Delete the 'topic' variable row in Data Inspector (ensure inspector is open)
    cy.get('[data-testid="builder-v2-linear"]').should('exist');
    cy.get('body').then(($body) => {
      const hasInspector = $body.find('[data-testid="data-inspector"]').length > 0;
      if (!hasInspector) {
        const hasToggle = $body.find('[data-testid="data-inspector-toggle"]').length > 0;
        if (hasToggle) {
          cy.get('[data-testid="data-inspector-toggle"]').click({ force: true });
        } else {
          cy.contains('button', /^Data$/).click({ force: true });
        }
      }
    });
    cy.get('[data-testid="data-inspector"]').should('be.visible');
    cy.get('[data-testid="data-inspector"]').within(() => {
      cy.get('[data-testid="data-inspector-var-row"]').then(($rows) => {
        const row = Array.from($rows).find(r => {
          const keyInput = r.querySelector('input[placeholder="key"]') as HTMLInputElement | null;
          return keyInput && keyInput.value === 'topic';
        });
        if (row) {
          const btn = row.querySelector('button');
          (btn as HTMLButtonElement).click();
        }
      });
    });
    // Save again to persist removal
    cy.get('[data-testid="save-workflow"]').click();
    cy.url().should('match', /\/workflows\/[^/]+\/edit\?v2=1$/);
    // After hydration, only feeling remains; topic removed
    cy.get('[data-testid="variable-inspector"]').within(() => {
      cy.get('[data-testid="variable-item-workflow.feeling"]').should('have.length', 1);
      cy.get('[data-testid="variable-item-workflow.topic"]').should('not.exist');
    });
    // Ensure inspector open for final assertion
    cy.get('body').then(($body) => {
      const hasInspector = $body.find('[data-testid="data-inspector"]').length > 0;
      if (!hasInspector) {
        const hasToggle = $body.find('[data-testid="data-inspector-toggle"]').length > 0;
        if (hasToggle) {
          cy.get('[data-testid="data-inspector-toggle"]').click({ force: true });
        } else {
          cy.contains('button', /^Data$/).click({ force: true });
        }
      }
    });
    cy.get('[data-testid="data-inspector"]').should('be.visible');
    cy.get('[data-testid="data-inspector"]').within(() => {
      cy.get('[data-testid="data-inspector-var-row"]').should('have.length', 1);
      cy.get('[data-testid="data-inspector-var-row"]').within(() => {
        cy.get('input[placeholder="key"]').should('have.value', 'feeling');
        cy.get('input[placeholder="value"]').should('have.value', 'pensive');
      });
    });
  });

  it('saving twice is idempotent: no duplicate steps or variables after second save', () => {
    gotoBuilderV2();
    addPromptStep();
    addPromptStep();
    cy.get('[data-testid="step-card"]').should('have.length', 2);
    cy.get('[data-testid="data-inspector-toggle"]').click();
    cy.contains('Add variable').click();
    cy.get('[data-testid="data-inspector"]').within(() => {
      cy.get('[data-testid="data-inspector-var-row"]').within(() => {
        cy.get('input[placeholder="key"]').type('feeling');
        cy.get('input[placeholder="value"]').type('steady');
      });
    });
    cy.get('[data-testid="workflow-name-input"]').clear().type(`V2 Idempotent Save ${unique}`);
    cy.get('[data-testid="save-workflow"]').click();
    cy.url().should('match', /\/workflows\/[^/]+\/edit\?v2=1$/);
    // After first save, confirm two steps and single variable instance
    cy.get('[data-testid="step-card"]').should('have.length', 2);
    cy.get('[data-testid="variable-item-workflow.feeling"]').should('have.length', 1);
    // Save again without changes
    cy.get('[data-testid="save-workflow"]').click();
    cy.url().should('match', /\/workflows\/[^/]+\/edit\?v2=1$/);
    // Still exactly two steps and one variable instance
    cy.get('[data-testid="step-card"]').should('have.length', 2);
    cy.get('[data-testid="variable-item-workflow.feeling"]').should('have.length', 1);
  });
});
