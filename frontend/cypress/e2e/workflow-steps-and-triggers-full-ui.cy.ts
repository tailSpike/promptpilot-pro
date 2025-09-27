/// <reference types="cypress" />

// This spec ensures we have UI coverage that creates, edits, and runs each workflow step type
// and creates each trigger type, exercising UI operations where possible.

// Deprecated in favor of split specs: workflow-create-all-steps-ui, workflow-edit-and-execute-ui, workflow-triggers-ui
describe.skip('Workflow Steps and Triggers - Full UI Coverage', () => {
  let testUser: { token: string; user: { id: string; email: string; name: string } };
  let workflowId: string;

  const createAndLoginTestUser = () => {
    const userData = {
      name: `Steps & Triggers User ${Date.now()}`,
      email: `steps-triggers-${Date.now()}@example.com`,
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

  const saveWorkflowFromEditor = () => {
    cy.get('[data-testid="submit-workflow-button"]').should('be.enabled').click();
    cy.url({ timeout: 30000 }).should('include', '/workflows');
  };

  const goToWorkflowEdit = () => {
    const navigate = () => {
      if (workflowId) {
        visitWithAuth(`/workflows/${workflowId}/edit`);
        cy.url().should('include', '/edit');
      }
    };
    if (workflowId) {
      navigate();
    } else {
      ensureWorkflowIdByName('Full UI Coverage Workflow').then((id) => {
        workflowId = id;
        navigate();
      });
    }
  };

  before(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    return createAndLoginTestUser();
  });

  // Helper: visit with auth preloaded
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

  // Helper: poll backend for workflow by name and set workflowId
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

  it('creates a workflow via UI and adds each step type with valid configs', () => {
    // Register key intercepts before page load
    cy.intercept('GET', '**/api/prompts*').as('loadPrompts');
    cy.intercept('POST', '**/api/workflows').as('createWorkflow');
    cy.intercept('GET', '**/api/workflows*').as('listWorkflows');

    visitWithAuth('/workflows/new');
    cy.wait('@loadPrompts');

    // Basic info (use explicit IDs from WorkflowEditor)
    cy.get('#name').should('be.visible').type('Full UI Coverage Workflow');
    cy.get('#description').type('Workflow covering all step types');

    // Add step helper
    const addStep = () => {
      cy.get('[data-testid="add-step-button"]').should('be.visible').click();
    };

    // Step 1: PROMPT (inline)
    addStep();
    cy.get('[data-testid="workflow-step-0"]').within(() => {
      cy.get('[data-testid^="step-name-"]').clear().type('Prompt Step');
      cy.get('[data-testid^="step-type-"]').select('PROMPT');
      // Ensure inline prompt is selected (radio name is promptSource-0)
      cy.get('input[name="promptSource-0"][value="inline"]').check({ force: true });
      cy.contains('Prompt Content').parent().find('textarea').type('Write a haiku about {{topic}}', { parseSpecialCharSequences: false });
      cy.contains('Prompt Content').parent().find('textarea').should('have.value', 'Write a haiku about {{topic}}');
      // Model settings
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

  // Save workflow: submit the form to ensure onSubmit executes
  cy.get('form').first().submit();
    // Wait for either create or list to complete and derive workflowId
    cy.wait(['@createWorkflow', '@listWorkflows'], { timeout: 30000 }).then((interceptions) => {
      const first = Array.isArray(interceptions) ? interceptions[0] : interceptions;
      const second = Array.isArray(interceptions) ? interceptions[1] : null;
      // Try to get ID from create response
      const createBody = first && first.request?.method === 'POST' ? first.response?.body as unknown : undefined;
      const createdId = createBody && typeof createBody === 'object' ? (createBody as Record<string, unknown>).id as string | undefined : undefined;
      if (createdId) {
        workflowId = createdId;
      } else if (second) {
        const listBody = second.response?.body as unknown;
        const list = listBody && typeof listBody === 'object' ? (listBody as Record<string, unknown>).workflows as Array<Record<string, unknown>> | undefined : undefined;
        const wf = list?.find(w => w && typeof w === 'object' && (w as Record<string, unknown>).name === 'Full UI Coverage Workflow');
        if (wf) workflowId = (wf as Record<string, unknown>).id as string;
      }
    });
    // Fallback: if ID not captured, check for validation error text before polling
    cy.get('body').then($body => {
      if ($body.text().includes('Please fix the following issues')) {
        throw new Error('Workflow creation validation failed');
      }
    });
    // Then, if ID not captured, resolve via polling
    if (!workflowId) {
      ensureWorkflowIdByName('Full UI Coverage Workflow').should('be.a', 'string').then((id) => {
        workflowId = id;
      });
    }
  });

  it('edits a step and executes the workflow from the UI', () => {
    goToWorkflowEdit();

    // Ensure steps have been persisted before interacting
    if (workflowId) {
      cy.request({
        method: 'GET',
        url: `${Cypress.env('apiUrl')}/api/workflows/${workflowId}`,
        headers: { Authorization: `Bearer ${testUser.token}` }
      }).its('body.steps').should('have.length.greaterThan', 0);
    }

    // Edit the first step name
    cy.get('[data-testid="workflow-step-0"]').within(() => {
      cy.get('[data-testid^="step-name-"]').clear().type('Prompt Step (edited)');
    });

    // Save updates
    saveWorkflowFromEditor();

    // Open details and execute if available
    if (workflowId) {
      cy.visit(`/workflows/${workflowId}`);
    } else {
      cy.get('a[href*="/workflows/"]').first().click();
    }
    cy.get('body').then(($body) => {
      if ($body.find('button:contains("Execute")').length > 0) {
        cy.get('button').contains(/execute/i).click();
        cy.get('body', { timeout: 10000 }).should('not.contain', 'Error executing');
      }
    });
  });

  it('creates each trigger type via UI and exercises available operations', () => {
    // Navigate to workflow detail (ensure ID is present)
    ensureWorkflowIdByName('Full UI Coverage Workflow').should('be.a', 'string').then((id) => {
      workflowId = id;
      visitWithAuth(`/workflows/${workflowId}`);
    });
    cy.get('[data-testid="workflow-triggers"]', { timeout: 15000 }).should('be.visible');

    const openCreateTrigger = () => {
      cy.get('body').then(($body) => {
        if ($body.find('button:contains("Create your first trigger")').length > 0) {
          cy.contains('Create your first trigger').click();
        } else {
          cy.contains('Add Trigger').click();
        }
      });
      cy.contains('Create New Trigger').should('be.visible');
    };

    // Helper to create trigger by type
    const createTrigger = (name: string, type: 'MANUAL' | 'SCHEDULED' | 'WEBHOOK' | 'API' | 'EVENT') => {
      openCreateTrigger();
      cy.get('input[placeholder="Enter trigger name"]').clear().type(name);
      cy.get('[data-testid="trigger-type"]').select(type);
      if (type === 'SCHEDULED') {
        // Switch to Advanced mode and set a cron expression
        cy.contains('Advanced').click();
        cy.get('#cron-expression').should('be.visible').clear().type('*/10 * * * *');
      }
      cy.contains('Create Trigger').click();
      // brief wait for toast/refresh
      cy.wait(1500);
    };

    // Create triggers of all types
    createTrigger('UI Manual Trigger', 'MANUAL');
    createTrigger('UI Scheduled Trigger', 'SCHEDULED');
    createTrigger('UI Webhook Trigger', 'WEBHOOK');
    createTrigger('UI API Trigger', 'API');
    createTrigger('UI Event Trigger', 'EVENT');

    // Exercise available UI operations
    cy.get('body').then(($body) => {
      // Run button (for manual triggers)
      if ($body.find('[data-testid="trigger-run"]').length > 0) {
        cy.get('[data-testid="trigger-run"]').first().click();
        cy.wait(1000);
      }
      // Toggle button exists for active/inactive
      if ($body.find('[data-testid="trigger-toggle"]').length > 0) {
        cy.get('[data-testid="trigger-toggle"]').first().click();
        cy.wait(500);
        cy.get('[data-testid="trigger-toggle"]').first().click();
      }
    });
  });
});
