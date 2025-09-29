/// <reference types="cypress" />

describe('Workflow trigger regression smoke', () => {
  const backendUrl = () => Cypress.env('apiUrl') as string;
  const password = 'testpassword123!';
  const suffix = Date.now();
  const userEmail = `trigger-regression-${suffix}@example.com`;
  const userName = 'Trigger Regression User';
  const workflowName = `Trigger Regression Workflow ${suffix}`;

  let authToken: string;
  let workflowId: string;
  let userProfile: { id: string; email: string; name: string };

  const ensureManualTriggerExists = () => {
    return cy
      .request({
        method: 'GET',
        url: `${backendUrl()}/api/workflows/${workflowId}/triggers`,
        headers: { Authorization: `Bearer ${authToken}` }
      })
      .then((response) => {
        const existingManual = Array.isArray(response.body)
          ? response.body.find((trigger: { type?: string }) => trigger?.type === 'MANUAL')
          : undefined;

        if (existingManual) {
          return existingManual;
        }

        return cy
          .request({
            method: 'POST',
            url: `${backendUrl()}/api/workflows/${workflowId}/triggers`,
            headers: { Authorization: `Bearer ${authToken}` },
            body: {
              name: 'Regression Manual Trigger',
              type: 'MANUAL',
              isActive: true,
              config: {}
            }
          })
          .its('body');
      });
  };

  const visitWorkflowWithAuth = () => {
    cy.visit(`/workflows/${workflowId}`, {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', authToken);
        win.localStorage.setItem('user', JSON.stringify(userProfile));
      }
    });
  };

  before(() => {
    cy.clearCookies();
    cy.clearLocalStorage();

    cy.request({
      method: 'POST',
      url: `${backendUrl()}/api/auth/register`,
      body: {
        name: userName,
        email: userEmail,
        password
      }
    })
      .then((registerResponse) => {
        authToken = registerResponse.body.token;
        userProfile = registerResponse.body.user;

        return cy.request({
          method: 'POST',
          url: `${backendUrl()}/api/workflows`,
          headers: { Authorization: `Bearer ${authToken}` },
          body: {
            name: workflowName,
            description: 'Workflow used for trigger regression validation',
            isActive: true,
            steps: [
              {
                name: 'Prompt Step',
                type: 'PROMPT',
                order: 0,
                config: {
                  content: 'Hello {{user}}',
                  model: 'gpt-4o-mini'
                }
              }
            ]
          }
        });
      })
      .then((workflowResponse) => {
        workflowId = workflowResponse.body.id;
        expect(workflowId, 'workflow id should be created').to.be.a('string');
      });
  });

  it('creates a manual trigger via UI without introducing 404 responses', () => {
    const errorResponses: Array<{ method: string; status: number; url: string }> = [];

    cy.intercept(
      { url: `${backendUrl()}/**`, middleware: true },
      (req) => {
        req.on('response', (res) => {
          if (res.statusCode >= 400) {
            errorResponses.push({ method: req.method, status: res.statusCode, url: req.url });
          }
        });
      }
    );

    visitWorkflowWithAuth();
    cy.get('[data-testid="workflow-triggers"]', { timeout: 20000 }).should('be.visible');

    cy.get('body').then(($body) => {
      if ($body.find('button:contains("Create your first trigger")').length > 0) {
        cy.contains('Create your first trigger').click();
      } else {
        cy.contains('Add Trigger').click();
      }
    });

    cy.contains('Create New Trigger').should('be.visible');
    cy.get('input[placeholder="Enter trigger name"]').clear().type('Regression Manual Trigger');
    cy.get('[data-testid="trigger-type"]').select('MANUAL');

    cy.intercept('POST', `**/api/workflows/${workflowId}/triggers`).as('createTrigger');
    cy.contains('Create Trigger').click();

    cy.wait('@createTrigger').its('response.statusCode').should('eq', 201);
    cy.wrap(errorResponses.filter((entry) => entry.status === 404)).should('have.length', 0);
  });

  it('runs and toggles a manual trigger without console 404s', () => {
    ensureManualTriggerExists();

    visitWorkflowWithAuth();
    cy.get('[data-testid="workflow-triggers"]', { timeout: 20000 }).should('be.visible');

    cy.window().then((win) => {
      cy.stub(win.console, 'error').as('consoleError');
      cy.stub(win.console, 'warn').as('consoleWarn');
    });

    cy.get('[data-testid="trigger-run"]').first().click({ force: true });
    cy.wait(1000);

    cy.get('[data-testid="trigger-toggle"]').first().click({ force: true });
    cy.wait(500);
    cy.get('[data-testid="trigger-toggle"]').first().click({ force: true });

    const assertNo404Messages = (stub: Cypress.Agent<sinon.SinonStub>) => {
      const messages = stub.getCalls().map((call) => call.args.join(' '));
      const hits404 = messages.filter((message) => /404|Not Found/i.test(message));
      expect(hits404, 'console output should not contain 404s').to.have.length(0);
    };

    cy.get<Cypress.Agent<sinon.SinonStub>>('@consoleError').then((stub) => {
      assertNo404Messages(stub);
    });

    cy.get<Cypress.Agent<sinon.SinonStub>>('@consoleWarn').then((stub) => {
      assertNo404Messages(stub);
    });
  });
});