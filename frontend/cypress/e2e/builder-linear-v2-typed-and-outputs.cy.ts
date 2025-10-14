/// <reference types="cypress" />

describe('Linear Builder V2 - Typed variables and Step Output binding', () => {
  const apiUrl = Cypress.env('apiUrl');
  const unique = Date.now();
  const user = {
    name: `Builder Typed ${unique}`,
    email: `builder.typed${unique}@example.com`,
    password: 'Test1234!'
  };
  let auth: { token: string; user: { id: string; email: string; name: string } };

  before(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.request(`${apiUrl}/api/health`).its('status').should('eq', 200);
    cy.request('POST', `${apiUrl}/api/auth/register`, user).then((response) => { auth = response.body; });
  });

  const gotoBuilderV2 = () => {
    cy.visit('/workflows/new', {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', auth.token);
        win.localStorage.setItem('user', JSON.stringify(auth.user));
      },
    });
    cy.get('[data-testid="builder-v2-toggle"]', { timeout: 15000 }).should('be.visible').click({ force: true });
    cy.get('[data-testid="builder-v2-linear"]').should('exist');
  };

  const addPromptStep = () => {
    cy.get('[data-testid="add-step"]').click();
    cy.get('[data-testid="step-type-PROMPT"]').click();
    cy.get('[data-testid="step-card"]').should('exist');
  };

  it('creates string+number+boolean variables, saves, and hydrates types', () => {
    gotoBuilderV2();
    addPromptStep();
    cy.get('[data-testid="data-inspector-toggle"]').click();
    // Add three vars
    cy.contains('Add variable').click();
    cy.contains('Add variable').click();
    cy.contains('Add variable').click();

    cy.get('[data-testid="data-inspector"]').within(() => {
      cy.get('[data-testid="data-inspector-var-row"]').eq(0).within(() => {
        cy.get('select[data-testid="data-inspector-var-type"]').select('string');
        cy.get('input[placeholder="key"]').type('topic');
        cy.get('input[placeholder="value"]').type('Testing');
      });
      cy.get('[data-testid="data-inspector-var-row"]').eq(1).within(() => {
        cy.get('select[data-testid="data-inspector-var-type"]').select('number');
        cy.get('input[placeholder="key"]').type('count');
        cy.get('input[placeholder="value"]').type('3');
      });
      cy.get('[data-testid="data-inspector-var-row"]').eq(2).within(() => {
        cy.get('select[data-testid="data-inspector-var-type"]').select('boolean');
        cy.get('input[placeholder="key"]').type('enabled');
        cy.get('select[data-testid="data-inspector-var-value-boolean"]').select('true');
      });
    });

    cy.get('[data-testid="workflow-name-input"]').clear().type(`V2 Typed ${unique}`);
    cy.get('[data-testid="save-workflow"]').click();
    cy.url().should('match', /\/workflows\/[^/]+\/edit\?v2=1$/);
    cy.get('[data-testid="builder-v2-linear"]').should('exist');
    cy.get('[data-testid="data-inspector-toggle"]').click();
    cy.get('[data-testid="data-inspector"]').within(() => {
      cy.get('[data-testid="data-inspector-var-row"]').should('have.length', 3);
      cy.get('[data-testid="data-inspector-var-row"]').eq(0).within(() => {
        cy.get('select[data-testid="data-inspector-var-type"]').should('have.value', 'string');
        cy.get('input[placeholder="key"]').should('have.value', 'topic');
        cy.get('input[placeholder="value"]').should('have.value', 'Testing');
      });
      cy.get('[data-testid="data-inspector-var-row"]').eq(1).within(() => {
        cy.get('select[data-testid="data-inspector-var-type"]').should('have.value', 'number');
        cy.get('input[placeholder="key"]').should('have.value', 'count');
        cy.get('input[placeholder="value"]').should('have.value', '3');
      });
      cy.get('[data-testid="data-inspector-var-row"]').eq(2).within(() => {
        cy.get('select[data-testid="data-inspector-var-type"]').should('have.value', 'boolean');
        cy.get('input[placeholder="key"]').should('have.value', 'enabled');
        cy.get('select[data-testid="data-inspector-var-value-boolean"]').should('have.value', 'true');
      });
    });
  });

  it('binds step 1 output into step 2 after Preview; persists token; warns on forward-ref', () => {
    gotoBuilderV2();
    addPromptStep();
    addPromptStep();
    // Ensure prompt content has a deterministic text
    cy.get('[data-testid="step-card"]').eq(0).within(() => {
      cy.get('[data-testid="input-field-promptContent"]').clear().type('Hello {{workflow.input}}');
    });
    cy.get('[data-testid="step-card"]').eq(1).within(() => {
      cy.get('[data-testid="input-field-promptContent"]').clear().type('Second:');
      cy.get('[data-testid="input-field-promptContent"]').click();
    });
    cy.get('[data-testid="preview-run"]').click();
    // Step outputs should appear; click first output to insert into step 2
    cy.get('[data-testid="variable-inspector"]').within(() => {
      cy.contains('Step Outputs');
      cy.get('[data-testid^="variable-item-step."]').first().click();
    });
    cy.get('[data-testid="step-card"]').eq(1).within(() => {
      cy.get('[data-testid="input-field-promptContent"]').should('contain.value', '{{step.');
    });
    // Save and ensure persists
    cy.get('[data-testid="workflow-name-input"]').clear().type(`V2 Output Bind ${unique}`);
    cy.get('[data-testid="save-workflow"]').click();
    cy.url().should('match', /\/workflows\/[^/]+\/edit\?v2=1$/);
    cy.get('[data-testid="step-card"]').eq(1).within(() => {
      cy.get('[data-testid="input-field-promptContent"]').should('contain.value', '{{step.');
    });
    // Reorder to make forward reference invalid: move step 2 up
    cy.get('[data-testid="step-card"]').eq(1).within(() => { cy.contains('button', '▲').click(); });
    cy.get('[data-testid="step-card"]').eq(0).within(() => {
      cy.get('[data-testid="output-forward-ref-warning"]').should('exist');
    });
  });
});
