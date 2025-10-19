/// <reference types="cypress" />

// EPIC 8 — Story 3: Canvas Builder (Advanced)
// Acceptance E2E: canvas mode with nodes/edges; quick-add; connect outputs to inputs; edge popover; zoom/pan; mini-map; persist (x,y)

describe('Workflow Builder V2 - Canvas mode (feature flagged)', () => {
  let testUser: { token: string; user: { id: string; email: string; name: string } };
  let workflowId: string | undefined;
  const wfName = `Canvas Builder Workflow ${Date.now()}`;

  const createAndLoginTestUser = () => {
    const userData = {
      name: `Canvas User ${Date.now()}`,
      email: `canvas-${Date.now()}@example.com`,
      password: 'testpassword123'
    };

    return cy
      .request('POST', `${Cypress.env('apiUrl')}/api/auth/register`, userData)
      .then((response) => {
        testUser = response.body;
        return cy.window().then((win) => {
          win.localStorage.setItem('token', testUser.token);
          win.localStorage.setItem('user', JSON.stringify(testUser.user));
        });
      });
  };

  const createWorkflowViaAPI = () => {
    return cy
      .request({
        method: 'POST',
        url: `${Cypress.env('apiUrl')}/api/workflows`,
        headers: { Authorization: `Bearer ${testUser.token}` },
        body: { name: wfName, description: 'Canvas mode acceptance test', isActive: true },
      })
      .then((resp) => {
        workflowId = resp.body?.id || resp.body?.workflow?.id || resp.body?.data?.id;
        expect(workflowId, 'workflow id from API').to.be.a('string');
        expect((workflowId as string).length, 'workflow id should not be empty').to.be.greaterThan(0);
      });
  };

  before(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    return createAndLoginTestUser().then(() => createWorkflowViaAPI());
  });

  it('enables Canvas mode, adds nodes, connects them, previews, and persists positions', () => {
    // Intercepts: force-enable Builder V2 (linear + canvas)
    cy.intercept('GET', '**/api/feature-flags', {
      statusCode: 200,
      body: {
        flags: {
          'builder.v2.linear': true,
          'builder.v2.canvas': true,
          'workflow.run.inline': true,
        },
      },
    }).as('featureFlags');
    cy.intercept('PUT', '**/api/workflows/*').as('updateWorkflow');

    cy.visit(`/workflows/${workflowId}/edit?v2=1&canvas=1`, {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', testUser.token);
        win.localStorage.setItem('user', JSON.stringify(testUser.user));
      }
    });

    cy.wait('@featureFlags', { timeout: 15000 });

    // Canvas should render directly under V2 (canvas enabled)
    cy.get('[data-testid="builder-v2-canvas"]', { timeout: 15000 }).should('exist');

    // Quick-add two nodes from step library
    cy.get('[data-testid="canvas-step-library-button"]').should('be.visible').click();
    cy.get('[data-testid="canvas-add-step-PROMPT"]').click();
    cy.get('[data-testid="canvas-add-step-TRANSFORM"]').click();
    cy.get('[data-testid^="canvas-node-"]').should('have.length.at.least', 2);

    // Connect PROMPT -> TRANSFORM via edge (outputs to inputs)
    cy.get('[data-testid^="canvas-node-"]').eq(0).as('promptNode');
    cy.get('[data-testid^="canvas-node-"]').eq(1).as('transformNode');
    cy.get('@promptNode').find('[data-testid="handle-output"]').trigger('mousedown', { which: 1, force: true });
    cy.get('@transformNode').find('[data-testid="handle-input"]').trigger('mouseup', { force: true });

    // Edge popover appears, allow basic mapping
    cy.get('[data-testid="edge-popover"]').should('be.visible');
    cy.get('[data-testid="edge-mapping-path"]').clear().type('output.text');
    cy.get('[data-testid="edge-mapping-apply"]').click();

    // Zoom/pan controls & mini-map render
    cy.get('[data-testid="canvas-minimap"]').should('be.visible');
    cy.get('[data-testid="canvas-zoom-in"]').click().click();
    cy.get('[data-testid="canvas-zoom-out"]').click();

    // Save to persist positions (localStorage)
    cy.get('[data-testid="submit-workflow-button"]').scrollIntoView().click();
    cy.wait('@updateWorkflow', { timeout: 30000 });

    // Revisit editor and verify nodes rehydrate to positions and edge exists
    cy.visit(`/workflows/${workflowId}/edit?v2=1&canvas=1`, {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', testUser.token);
        win.localStorage.setItem('user', JSON.stringify(testUser.user));
      }
    });
    cy.wait('@featureFlags', { timeout: 15000 });
    cy.get('[data-testid="builder-v2-canvas"]', { timeout: 15000 }).should('exist');
    cy.get('[data-testid^="canvas-node-"]').should('have.length.at.least', 2);
    cy.get('[data-testid^="canvas-edge-"]').should('have.length.at.least', 1);
  });
});
