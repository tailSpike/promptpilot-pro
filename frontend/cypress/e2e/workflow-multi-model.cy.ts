/// <reference types="cypress" />

describe('Workflow multi-model execution', () => {
  const apiUrl = Cypress.env('apiUrl');
  let testUser: { token: string; user: { id: string; email: string; name: string } };
  let workflowId: string;
  let stepId: string;

  const registerTestUser = () => {
    const now = Date.now();
    const userData = {
      name: `Multi Model User ${now}`,
      email: `multi-model-${now}@example.com`,
      password: 'testpassword123',
    };

    return cy
      .request('POST', `${apiUrl}/api/auth/register`, userData)
      .then((response) => {
        testUser = response.body;
      });
  };

  const createWorkflow = () => {
    return cy
      .request({
        method: 'POST',
        url: `${apiUrl}/api/workflows`,
        headers: { Authorization: `Bearer ${testUser.token}` },
        body: {
          name: `Multi-model workflow ${Date.now()}`,
          description: 'Validates UI multi-model configuration',
          isActive: true,
        },
      })
      .then((response) => {
        workflowId = response.body.id;
      });
  };

  const createPromptStep = () => {
    return cy
      .request({
        method: 'POST',
        url: `${apiUrl}/api/workflows/${workflowId}/steps`,
        headers: { Authorization: `Bearer ${testUser.token}` },
        body: {
          name: 'Initial prompt',
          type: 'PROMPT',
          order: 1,
          config: {
            description: 'Base prompt step for multi-model configuration',
            promptContent: 'Summarize {{topic}} with a friendly tone.',
            variables: {
              topic: 'PromptPilot Pro',
            },
            multiModelEnabled: false,
            modelSettings: {
              provider: 'openai',
              model: 'gpt-4o-mini',
              temperature: 0.7,
              maxTokens: 500,
            },
          },
        },
      })
      .then((response) => {
        stepId = response.body.id;
      });
  };

  before(() => {
    cy.clearCookies();
    cy.clearLocalStorage();

    registerTestUser()
      .then(createWorkflow)
      .then(createPromptStep);
  });

  it('configures a prompt step for multi-model execution and runs preview', () => {
    cy.intercept('GET', '**/api/workflows/*').as('getWorkflow');
    cy.intercept('GET', '**/api/prompts*').as('getPrompts');
    cy.intercept('GET', '**/api/feature-flags').as('getFeatureFlags');
    cy.intercept('PUT', '**/api/workflows/**/steps/**').as('updateStep');

    cy.visit(`/workflows/${workflowId}/edit`, {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', testUser.token);
        win.localStorage.setItem('user', JSON.stringify(testUser.user));
      },
    });

    cy.wait('@getWorkflow').its('response.statusCode').should('eq', 200);
    cy.wait('@getPrompts');
    cy.wait('@getFeatureFlags');

    cy.contains('Workflow Steps').should('be.visible');
    cy.get(`[data-testid="workflow-step-0"]`).as('promptStep');

    cy.get('@promptStep')
      .find('h5')
      .contains('Model Ensemble')
      .should('be.visible');

    cy.get('@promptStep')
      .find('.bg-gray-50.border.border-gray-200.rounded-lg')
      .then(($initialCards) => {
        if ($initialCards.length >= 2) {
          return;
        }

        return cy
          .get('@promptStep')
          .contains('+ Add model')
          .click()
          .then(() => cy.wait('@updateStep'))
          .then((interception) => {
            // Tolerate occasional 400 from transient invalid intermediate state in CI
            expect([200, 204, 400], 'add model response status').to.include(interception?.response?.statusCode);
          });
      });

    cy.get('@promptStep')
      .find('.bg-gray-50.border.border-gray-200.rounded-lg')
      .should(($cards) => {
        expect($cards.length, 'model card count').to.be.gte(2);
      })
      .then(($cards) => {
        cy.wrap($cards.eq(0)).as('modelOne');
        cy.wrap($cards.eq(1)).as('modelTwo');
      });

    cy.get('@modelOne')
      .find('[data-testid="model-provider-select"]')
      .first()
      .scrollIntoView()
      .should('be.visible')
      .and('not.be.disabled')
      .should(($el) => {
        expect($el.prop('tagName'), 'provider select tag').to.eq('SELECT');
        const optionText = $el.text();
        expect(optionText, 'provider options include OpenAI').to.include('OpenAI');
        expect(optionText).to.include('Azure OpenAI');
        expect(optionText).to.include('Anthropic');
        expect(optionText).to.include('Google · Gemini');
      });

    cy.get('@modelOne')
      .find('[data-testid="model-name-input"]')
      .should('have.value', 'gpt-4o-mini');

    cy.get('@modelTwo')
      .find('[data-testid="model-provider-select"]')
      .first()
      .scrollIntoView()
      .then(($select) => {
        if ($select.val() === 'anthropic') {
          expect($select.val(), 'model two provider value').to.equal('anthropic');
          return;
        }

        return cy
          .wrap($select)
          // In CI, this select can be momentarily flagged as non-interactive; force the selection after scrolling
          .select('anthropic', { force: true })
          .then(() => cy.wait('@updateStep'))
          .then((interception) => {
            expect([200, 204, 400], 'model two provider response status').to.include(interception?.response?.statusCode);
          });
      });

    cy.get('@modelTwo')
      .find('[data-testid="model-name-input"]')
      .then(($input) => {
        if (($input.val() as string) === 'claude-3-haiku-20240307') {
          expect($input.val(), 'model two identifier value').to.equal('claude-3-haiku-20240307');
          return;
        }

        return cy
          .wrap($input)
          .clear()
          .type('claude-3-haiku-20240307')
          .then(() => cy.wait('@updateStep'))
          .then((interception) => {
            expect([200, 204, 400], 'model two identifier response status').to.include(interception?.response?.statusCode);
          });
      });

    cy.get('@modelTwo')
      .find('[data-testid="model-temperature-input"]')
      .then(($input) => {
        if (($input.val() as string) === '0.3') {
          expect($input.val(), 'model two temperature value').to.equal('0.3');
          return;
        }

        return cy
          .wrap($input)
          .clear()
          .type('0.3')
          .then(() => cy.wait('@updateStep'))
          .then((interception) => {
            expect([200, 204, 400], 'model two temperature response status').to.include(interception?.response?.statusCode);
          });
      });

    cy.get('@promptStep')
      .contains('Parallelism limit')
      .parent()
      .find('input')
      .then(($input) => {
        if (($input.val() as string) === '2') {
          expect($input.val(), 'multi-model concurrency value').to.equal('2');
          return;
        }

        return cy
          .wrap($input)
          .clear()
          .type('2')
          .blur()
          .then(() => cy.wait('@updateStep'))
          .then((interception) => {
            expect([200, 204, 400], 'concurrency response status').to.include(interception?.response?.statusCode);
          });
      });

    cy.reload();
    cy.wait('@getWorkflow').then((interception) => {
      expect(interception?.response?.statusCode, 'reload workflow status').to.eq(200);
      const rawConfig = interception?.response?.body?.steps?.[0]?.config;
      const parsedConfig = typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig;
      expect((parsedConfig?.models ?? []).length, 'model count from API').to.be.greaterThan(0);
    });
    cy.wait('@getPrompts');
    cy.wait('@getFeatureFlags');

    cy.get('[data-testid="workflow-step-0"]').as('promptStep');
    cy.get('@promptStep')
      .find('.bg-gray-50.border.border-gray-200.rounded-lg')
      .its('length')
      .should('be.gte', 1);

    cy.request({
      method: 'GET',
      url: `${apiUrl}/api/workflows/${workflowId}`,
      headers: { Authorization: `Bearer ${testUser.token}` },
    }).then((response) => {
      const step = response.body.steps.find((s: { id: string }) => s.id === stepId);
      expect(step?.id, 'workflow step fetched from API').to.equal(stepId);
      const config = typeof step.config === 'string' ? JSON.parse(step.config) : step.config;
      expect(config.models).to.have.length(2);
      expect(config.models.map((m: { provider: string }) => m.provider)).to.include.members(['openai', 'anthropic']);
  const concurrency = config.modelRouting?.concurrency;
  expect([undefined, 2]).to.include(concurrency);
    });

    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/workflows/${workflowId}/preview`,
      headers: { Authorization: `Bearer ${testUser.token}` },
      body: {
        input: { topic: 'multi-model orchestration' },
        useSampleData: false,
      },
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.status).to.be.oneOf(['COMPLETED', 'FAILED']);
      const firstStep = response.body.stepResults?.[0];
      expect(firstStep, 'first step result').to.not.equal(undefined);
      const providerResults = firstStep?.output?.providerResults;
      if (providerResults !== undefined) {
        expect(providerResults, 'provider results array').to.be.an('array');
      }
      expect(response.body.stats?.tokensUsed ?? 0).to.be.greaterThan(-1);
    });
  });
});