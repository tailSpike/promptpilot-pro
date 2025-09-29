/// <reference types="cypress" />

describe('Workflow - Create with all step types (UI)', () => {
  let testUser: { token: string; user: { id: string; email: string; name: string } };
  let workflowId: string | undefined;

  const createAndLoginTestUser = () => {
    const userData = {
      name: `Create Steps User ${Date.now()}`,
      email: `create-steps-${Date.now()}@example.com`,
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

  const visitWithAuth = (path: string) => {
    cy.visit(path, {
      onBeforeLoad(win) {
        if (testUser) {
          win.localStorage.setItem('token', testUser.token);
          win.localStorage.setItem('user', JSON.stringify(testUser.user));
        }
      }
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
        const wf = (resp.body.workflows || []).find((w: { id?: string; name?: string }) => w?.name === name);
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

  before(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    return createAndLoginTestUser();
  });

  it('creates a workflow via UI and adds each step type with valid configs', () => {
    // Intercepts before page load
    cy.intercept('GET', '**/api/prompts*').as('loadPrompts');
    cy.intercept('POST', '**/api/workflows').as('createWorkflow');
    cy.intercept('GET', '**/api/workflows*').as('listWorkflows');

    visitWithAuth('/workflows/new');
    cy.wait('@loadPrompts');

    // Basic info
    const wfName = `Full UI Coverage Workflow ${Date.now()}`;
    cy.get('#name').should('be.visible').type(wfName);
    cy.get('#description').type('Workflow covering all step types');

    const addStep = () => cy.get('[data-testid="add-step-button"]').should('be.visible').click();

    // Step 1: PROMPT (inline)
    addStep();
    cy.get('[data-testid="workflow-step-0"]').within(() => {
      cy.get('[data-testid^="step-name-"]').clear().type('Prompt Step');
      cy.get('[data-testid^="step-type-"]').select('PROMPT');
      cy.get('input[name="promptSource-0"][value="inline"]').check({ force: true });
      cy.contains('Prompt Content').parent().find('textarea').type('Write a haiku about {{topic}}', { parseSpecialCharSequences: false });
      cy.contains('Prompt Content').parent().find('textarea').should('have.value', 'Write a haiku about {{topic}}');
      cy.contains('Temperature').parent().find('input[type="number"]').clear().type('0.7');
      cy.contains('Max Tokens').parent().find('input[type="number"]').clear().type('256');
      cy.contains('Model').parent().find('select').select('gpt-3.5-turbo');
    });

    // Step 2: CONDITION
    addStep();
    cy.get('[data-testid="workflow-step-1"]').within(() => {
      cy.get('[data-testid^="step-name-"]').clear().type('Condition Step');
      cy.get('[data-testid^="step-type-"]').select('CONDITION');
      cy.contains('Field to Check').parent().find('input').clear().type('output.confidence');
      cy.contains('Operator').parent().find('select').select('greater_than');
      cy.contains('Value').parent().find('input').clear().type('0.5');
    });

    // Step 3: TRANSFORM
    addStep();
    cy.get('[data-testid="workflow-step-2"]').within(() => {
      cy.get('[data-testid^="step-name-"]').clear().type('Transform Step');
      cy.get('[data-testid^="step-type-"]').select('TRANSFORM');
      cy.contains('Input Field').parent().find('input').clear().type('previousStep.output');
      cy.contains('Output Field').parent().find('input').clear().type('transformedData');
      cy.contains('Operation').parent().find('select').select('format');
      cy.contains('Transformation Script').parent().find('textarea').type('return input.toUpperCase();');
    });

    // Step 4: DELAY
    addStep();
    cy.get('[data-testid="workflow-step-3"]').within(() => {
      cy.get('[data-testid^="step-name-"]').clear().type('Delay Step');
      cy.get('[data-testid^="step-type-"]').select('DELAY');
      cy.contains('Duration').parent().find('input[type="number"]').clear().type('1');
      cy.contains('Unit').parent().find('select').select('seconds');
      cy.contains('Reason for Delay').parent().find('input').type('Rate limiting');
    });

    // Step 5: WEBHOOK
    addStep();
    cy.get('[data-testid="workflow-step-4"]').within(() => {
      cy.get('[data-testid^="step-name-"]').clear().type('Webhook Step');
      cy.get('[data-testid^="step-type-"]').select('WEBHOOK');
      cy.contains('URL').parent().find('input').type('https://example.com/webhook');
      cy.contains('Method').parent().find('select').select('POST');
      cy.contains('Timeout').parent().find('input[type="number"]').clear().type('30');
      cy.contains('Retries').parent().find('input[type="number"]').clear().type('0');
    });

    // Step 6: DECISION
    addStep();
    cy.get('[data-testid="workflow-step-5"]').within(() => {
      cy.get('[data-testid^="step-name-"]').clear().type('Decision Step');
      cy.get('[data-testid^="step-type-"]').select('DECISION');
      cy.contains('Default Choice').parent().find('input').type('fallback');
    });

    // Submit form to trigger onSubmit
    cy.get('form').first().submit();
    cy.wait(['@createWorkflow', '@listWorkflows'], { timeout: 30000 }).then((interceptions) => {
      const first = Array.isArray(interceptions) ? interceptions[0] : interceptions;
      const second = Array.isArray(interceptions) ? interceptions[1] : null;
      const createBody = first && first.request?.method === 'POST' ? first.response?.body as unknown : undefined;
      const createdId = createBody && typeof createBody === 'object' ? (createBody as Record<string, unknown>).id as string | undefined : undefined;
      if (createdId) {
        workflowId = createdId;
      } else if (second) {
        const listBody = second.response?.body as unknown;
        const list = listBody && typeof listBody === 'object' ? (listBody as Record<string, unknown>).workflows as Array<Record<string, unknown>> | undefined : undefined;
        const wf = list?.find(w => w && typeof w === 'object' && (w as Record<string, unknown>).name === wfName);
        if (wf) workflowId = (wf as Record<string, unknown>).id as string;
      }
    });

    cy.get('body').then($body => {
      if ($body.text().includes('Please fix the following issues')) {
        throw new Error('Workflow creation validation failed');
      }
    });

    if (!workflowId) {
      ensureWorkflowIdByName(wfName).should('be.a', 'string').then((id) => { workflowId = id; });
    }

    // Verify it appears in list
    cy.url({ timeout: 30000 }).should('include', '/workflows');
    cy.contains(wfName).should('exist');
  });
});
