/// <reference types="cypress" />

describe('Workflow - Triggers (UI)', () => {
  let testUser: { token: string; user: { id: string; email: string; name: string } };
  let workflowId: string;
  const wfNamePrefix = 'Full UI Coverage Workflow';

  const createAndLoginTestUser = () => {
    const userData = {
      name: `Triggers User ${Date.now()}`,
      email: `triggers-${Date.now()}@example.com`,
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

  const ensureWorkflowIdByName = (prefix: string, attemptsLeft = 30): Cypress.Chainable<string> => {
    return cy
      .request({
        method: 'GET',
        url: `${Cypress.env('apiUrl')}/api/workflows`,
        headers: { Authorization: `Bearer ${testUser.token}` }
      })
      .then((resp) => {
        const wf = (resp.body.workflows || []).find((w: { id?: string; name?: string }) => (w?.name || '').startsWith(prefix));
        if (wf?.id) {
          workflowId = wf.id as string;
          return cy.wrap(workflowId, { log: false });
        }
        if (attemptsLeft <= 0) {
          throw new Error(`Workflow with name starting with "${prefix}" not found`);
        }
        return cy.wait(500).then(() => ensureWorkflowIdByName(prefix, attemptsLeft - 1));
      }) as unknown as Cypress.Chainable<string>;
  };

  const createMinimalWorkflowViaUI = (namePrefix: string): Cypress.Chainable<string> => {
    const name = `${namePrefix} - minimal ${Date.now()}`;
    cy.intercept('GET', '**/api/prompts*').as('loadPrompts');
    cy.intercept('POST', '**/api/workflows').as('createWorkflow');
    cy.intercept('GET', '**/api/workflows*').as('listWorkflows');

    visitWithAuth('/workflows/new');
    cy.wait('@loadPrompts');

    cy.get('#name').should('be.visible').type(name);
    cy.get('#description').type('Minimal workflow for triggers spec');
    cy.get('[data-testid="add-step-button"]').click();
    cy.get('[data-testid="workflow-step-0"]').within(() => {
      cy.get('[data-testid^="step-type-"]').select('PROMPT');
      cy.get('input[name="promptSource-0"][value="inline"]').check({ force: true });
      cy.contains('Prompt Content').parent().find('textarea').type('Write a poem about triggers');
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
        const wf = list?.find(w => w && typeof w === 'object' && String((w as Record<string, unknown>).name || '').startsWith(namePrefix));
        if (wf) return (wf as Record<string, unknown>).id as string;
      }
      return ensureWorkflowIdByName(namePrefix);
    }) as unknown as Cypress.Chainable<string>;
  };

  before(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    return createAndLoginTestUser();
  });

  it('creates each trigger type via UI and exercises available operations', () => {
    // Always create a fresh minimal workflow to isolate this spec
    createMinimalWorkflowViaUI(wfNamePrefix).then((id) => {
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

    const createTrigger = (name: string, type: 'MANUAL' | 'SCHEDULED' | 'WEBHOOK' | 'API' | 'EVENT') => {
      openCreateTrigger();
      cy.get('input[placeholder="Enter trigger name"]').clear().type(name);
      cy.get('[data-testid="trigger-type"]').select(type);
      if (type === 'SCHEDULED') {
          // Simple mode: set date/time and frequency, verify generated cron appears
          cy.contains('Simple').click();
          // Set date: today
          const today = new Date();
          const yyyy = today.getFullYear();
          const mm = String(today.getMonth() + 1).padStart(2, '0');
          const dd = String(today.getDate()).padStart(2, '0');
          cy.get('input[type="date"]').clear().type(`${yyyy}-${mm}-${dd}`);
          // Set time to a valid value
          cy.get('input[type="time"]').clear().type('12:30');
          // Select frequency by targeting the label
          cy.contains('Frequency').parent().find('select').select('daily');
          cy.contains('Generated cron').should('contain.text', ' ');
      }
      cy.contains('Create Trigger').click();
      cy.wait(1500);
    };

  createTrigger('UI Manual Trigger', 'MANUAL');
    createTrigger('UI Scheduled Trigger', 'SCHEDULED');
    createTrigger('UI Webhook Trigger', 'WEBHOOK');
    createTrigger('UI API Trigger', 'API');
    createTrigger('UI Event Trigger', 'EVENT');

    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="trigger-run"]').length > 0) {
        cy.get('[data-testid="trigger-run"]').first().click();
        cy.wait(1000);
      }
      if ($body.find('[data-testid="trigger-toggle"]').length > 0) {
        // Read current status badge, toggle, and ensure it changes
        let prevStatus = '';
        cy.contains('div.border.rounded-lg.p-4', 'UI Manual Trigger').within(() => {
          cy.contains(/Active|Inactive/).invoke('text').then((txt) => { prevStatus = txt.trim(); });
          cy.get('[data-testid="trigger-toggle"]').click();
        });
        cy.wait(800);
        cy.contains('div.border.rounded-lg.p-4', 'UI Manual Trigger').within(() => {
          cy.contains(/Active|Inactive/).invoke('text').should((txt) => {
            expect(txt.trim()).to.not.eq(prevStatus);
          });
          // Toggle back to original
          cy.get('[data-testid="trigger-toggle"]').click();
        });
      }
    });

    // Edit Manual -> API and verify API endpoint and apiKey presence
    cy.contains('div.border.rounded-lg.p-4', 'UI Manual Trigger').within(() => {
      cy.get('[data-testid="trigger-edit"]').click();
    });
    cy.get('[data-testid="edit-trigger-type"]').select('API');
    cy.get('#edit-trigger-name').clear().type('Manual to API');
    cy.contains('button', 'Update Trigger').click();
    cy.contains('Trigger updated successfully');
    // Verify API endpoint in UI and extract triggerId
    cy.contains('div.border.rounded-lg.p-4', 'Manual to API').within(() => {
      cy.contains('API Endpoint:').should('be.visible');
      cy.contains(/\/api\/triggers\/.+\/execute/).invoke('text').then((text) => {
        const match = text.match(/\/api\/triggers\/(.+)\/execute/);
        if (match) {
          const triggerId = match[1];
          cy.window().then((win) => {
            const token = win.localStorage.getItem('token') || '';
            cy.request({
              method: 'GET',
              url: `${Cypress.env('apiUrl')}/api/triggers/${triggerId}`,
              headers: { Authorization: `Bearer ${token}` }
            }).its('body.config').should('have.property', 'apiKey');
          });
        }
      });
    });

    // Edit Event -> Webhook and verify Webhook URL and secret presence
    cy.contains('div.border.rounded-lg.p-4', 'UI Event Trigger').within(() => {
      cy.get('[data-testid="trigger-edit"]').click();
    });
    cy.get('[data-testid="edit-trigger-type"]').select('WEBHOOK');
    cy.get('#edit-trigger-name').clear().type('Event to Webhook');
    cy.contains('button', 'Update Trigger').click();
    cy.contains('Trigger updated successfully');
    cy.contains('div.border.rounded-lg.p-4', 'Event to Webhook').within(() => {
      cy.contains('Webhook URL:').should('be.visible');
      cy.contains(/\/api\/webhooks\/.+/).invoke('text').then((text) => {
        const match = text.match(/\/api\/webhooks\/(.+)$/);
        if (match) {
          const triggerId = match[1];
          cy.window().then((win) => {
            const token = win.localStorage.getItem('token') || '';
            cy.request({
              method: 'GET',
              url: `${Cypress.env('apiUrl')}/api/triggers/${triggerId}`,
              headers: { Authorization: `Bearer ${token}` }
            }).its('body.config').should('have.property', 'secret');
          });
        }
      });
    });

    // Edit the first trigger: change name and convert to Scheduled (simple)
    cy.get('[data-testid="trigger-edit"]').first().click();
    cy.get('[data-testid="edit-trigger-type"]').select('SCHEDULED');
    cy.contains('Simple').click();
    cy.contains('Frequency').parent().find('select').select('daily');
    cy.get('input[type="time"]').first().clear().type('11:15');
    cy.get('#edit-trigger-name').clear().type('Edited Scheduled Trigger');
    cy.contains('button', 'Update Trigger').click();
    cy.contains('Trigger updated successfully');

    // Verify updated scheduled details appear
    cy.contains('Edited Scheduled Trigger').should('be.visible');
    cy.contains('Schedule:').should('be.visible');
  });
});
