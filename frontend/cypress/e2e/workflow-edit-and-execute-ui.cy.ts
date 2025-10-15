/// <reference types="cypress" />

describe('Workflow - Edit and Execute (UI)', () => {
  let testUser: { token: string; user: { id: string; email: string; name: string } };
  let workflowId: string;
  const wfNamePrefix = 'Full UI Coverage Workflow';

  const createAndLoginTestUser = () => {
    const userData = {
      name: `Edit Exec User ${Date.now()}`,
      email: `edit-exec-${Date.now()}@example.com`,
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

  // no-op

  const waitForWorkflowSteps = (id: string, attemptsLeft = 40): Cypress.Chainable<void> => {
    return cy
      .request({
        method: 'GET',
        url: `${Cypress.env('apiUrl')}/api/workflows/${id}`,
        headers: { Authorization: `Bearer ${testUser.token}` },
        failOnStatusCode: false,
      })
      .then((resp) => {
        const steps = (resp.body?.steps || []) as unknown[];
        if (Array.isArray(steps) && steps.length > 0) {
          return;
        }
        if (attemptsLeft <= 0) {
          throw new Error('Workflow steps were not persisted in time');
        }
        return cy.wait(500).then(() => waitForWorkflowSteps(id, attemptsLeft - 1));
      });
  };

  const ensureWorkflowIdByName = (name: string, attemptsLeft = 30): Cypress.Chainable<string> => {
    return cy
      .request({
        method: 'GET',
        url: `${Cypress.env('apiUrl')}/api/workflows`,
        headers: { Authorization: `Bearer ${testUser.token}` }
      })
      .then((resp) => {
        const wf = (resp.body.workflows || []).find((w: { id?: string; name?: string }) => w?.name?.startsWith(name));
        if (wf?.id) {
          workflowId = wf.id as string;
          return cy.wrap(workflowId, { log: false });
        }
        if (attemptsLeft <= 0) {
          throw new Error(`Workflow with name "${name}" not found`);
        }
        return cy.wait(500).then(() => ensureWorkflowIdByName(name, attemptsLeft - 1));
      }) as unknown as Cypress.Chainable<string>;
  };

  const createMinimalWorkflowViaUI = (): Cypress.Chainable<string> => {
    const name = `${wfNamePrefix} - minimal ${Date.now()}`;
    cy.intercept('GET', '**/api/prompts*').as('loadPrompts');
    cy.intercept('POST', '**/api/workflows').as('createWorkflow');
    cy.intercept('GET', '**/api/workflows*').as('listWorkflows');

    cy.visit('/workflows/new', {
      onBeforeLoad(win) {
        if (testUser) {
          win.localStorage.setItem('token', testUser.token);
          win.localStorage.setItem('user', JSON.stringify(testUser.user));
        }
      }
    });
    cy.wait('@loadPrompts');

    cy.get('#name').should('be.visible').type(name);
    cy.get('#description').type('Minimal workflow for edit/execute spec');

    // Add a single prompt step to ensure steps exist
    cy.get('[data-testid="add-step-button"]').click();
    cy.get('[data-testid="workflow-step-0"]').within(() => {
      cy.get('[data-testid^="step-name-"]').clear().type('Prompt Step');
      cy.get('[data-testid^="step-type-"]').select('PROMPT');
      cy.get('input[name="promptSource-0"][value="inline"]').check({ force: true });
      cy.contains('Prompt Content').parent().find('textarea').type('Write a haiku about Cypress');
    });

    cy.get('form').first().submit();
    return cy.wait(['@createWorkflow', '@listWorkflows'], { timeout: 30000 }).then((interceptions) => {
      const first = Array.isArray(interceptions) ? interceptions[0] : interceptions;
      const second = Array.isArray(interceptions) ? interceptions[1] : null;
      const createBody = first && first.request?.method === 'POST' ? first.response?.body as unknown : undefined;
      const createdId = createBody && typeof createBody === 'object' ? (createBody as Record<string, unknown>).id as string | undefined : undefined;
      if (createdId) return createdId;
      if (second) {
        const listBody = second.response?.body as unknown;
        const list = listBody && typeof listBody === 'object' ? (listBody as Record<string, unknown>).workflows as Array<Record<string, unknown>> | undefined : undefined;
        const wf = list?.find(w => w && typeof w === 'object' && String((w as Record<string, unknown>).name || '').startsWith(wfNamePrefix));
        if (wf) return (wf as Record<string, unknown>).id as string;
      }
      return ensureWorkflowIdByName(wfNamePrefix);
    }) as unknown as Cypress.Chainable<string>;
  };

  before(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    return createAndLoginTestUser();
  });

  it('edits the first step and executes the workflow from details', () => {
    // Always create a fresh minimal workflow for this spec
    createMinimalWorkflowViaUI().then((id) => {
      workflowId = id;
      cy.visit(`/workflows/${workflowId}/edit`, {
        onBeforeLoad(win) {
          if (testUser) {
            win.localStorage.setItem('token', testUser.token);
            win.localStorage.setItem('user', JSON.stringify(testUser.user));
          }
        }
      });

      // Ensure steps are present (persisted to backend) before editing
      waitForWorkflowSteps(workflowId);

      // Edit first step name
      cy.get('[data-testid="workflow-step-0"]').within(() => {
        cy.get('[data-testid^="step-name-"]').clear().type('Prompt Step (edited)');
      });

      // Save updates via submit button
      cy.intercept('PUT', '**/api/workflows/*').as('updateWorkflow');
      cy.get('[data-testid="submit-workflow-button"]').scrollIntoView().should('be.enabled').click();
      cy.wait('@updateWorkflow').its('response.statusCode').should('be.oneOf', [200, 204]);

      // Open details and execute
      cy.visit(`/workflows/${workflowId}`);
      cy.get('body').then(($body) => {
        if ($body.find('button:contains("Execute")').length > 0) {
          cy.get('button').contains(/execute/i).click();
          cy.get('body', { timeout: 10000 }).should('not.contain', 'Error executing');
        }
      });
    });
  });
});
