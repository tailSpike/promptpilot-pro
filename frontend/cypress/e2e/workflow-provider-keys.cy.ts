/// <reference types="cypress" />

interface StubCredential {
  id: string;
  provider: string;
  label: string;
  status: string;
  createdAt: string;
  lastRotatedAt: string;
  fingerprint: string;
  createdBy: {
    id: string;
    email: string;
  };
  metadata?: Record<string, unknown>;
}

describe('Integration keys workflow', () => {
  let credentials: StubCredential[];
  const authenticatedUser = {
    id: 'user-1',
    email: 'dev@example.com',
    name: 'Dev User',
  };

  const seedAuthSession = () => {
    cy.window().then((win) => {
      win.localStorage.setItem('token', 'test-token');
      win.localStorage.setItem('user', JSON.stringify(authenticatedUser));
    });
  };

  beforeEach(() => {
    credentials = [
      {
        id: 'cred-existing',
        provider: 'openai',
        label: 'Existing Sandbox',
        status: 'ACTIVE',
        createdAt: '2025-10-07T17:15:00.000Z',
        lastRotatedAt: '2025-10-07T17:15:00.000Z',
        fingerprint: 'fp-existing',
        createdBy: {
          id: 'user-1',
          email: 'dev@example.com',
        },
        metadata: {
          usageTag: 'ci-smoke',
        },
      },
    ];

    cy.clearCookies();
    cy.clearLocalStorage();
    seedAuthSession();

  cy.intercept('GET', '**/api/integrations/providers', {
      statusCode: 200,
      body: {
        providers: [
          {
            id: 'openai',
            name: 'OpenAI',
            description: 'OpenAI GPT family',
            sandbox: true,
            documentationUrl: 'https://platform.openai.com/docs',
          },
          {
            id: 'anthropic',
            name: 'Anthropic',
            description: 'Anthropic Claude family',
            sandbox: false,
            documentationUrl: 'https://docs.anthropic.com',
          },
        ],
      },
    }).as('getProviders');

  cy.intercept('GET', '**/api/auth/me', {
      statusCode: 200,
      body: { user: authenticatedUser },
    }).as('getProfile');

  cy.intercept('GET', '**/api/feature-flags', {
      statusCode: 200,
      body: { flags: { 'workflow.multiModel': true } },
    }).as('getFeatureFlags');

  cy.intercept('GET', '**/api/integrations/credentials', (req) => {
      req.reply({
        statusCode: 200,
        body: { data: credentials },
      });
    }).as('getCredentials');

  cy.intercept('POST', '**/api/integrations/credentials', (req) => {
      const credential: StubCredential = {
        id: `cred-${Date.now()}`,
        provider: req.body.provider,
        label: req.body.label,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        lastRotatedAt: new Date().toISOString(),
        fingerprint: `fp-${Date.now()}`,
        createdBy: {
          id: 'user-1',
          email: 'dev@example.com',
        },
        metadata: req.body.metadata ?? {},
      };

      credentials = [credential, ...credentials];

      req.reply({
        statusCode: 201,
        body: { data: credential },
      });
    }).as('createCredential');

  cy.intercept('PATCH', /https?:\/\/[^\s]+\/api\/integrations\/credentials\/.+|\/api\/integrations\/credentials\/.+/, (req) => {
      const id = req.url.split('/').pop() ?? '';
      const index = credentials.findIndex((credential) => credential.id === id);
      if (index >= 0) {
        credentials[index] = {
          ...credentials[index],
          status: 'ACTIVE',
          lastRotatedAt: new Date().toISOString(),
          metadata: req.body.metadata ?? credentials[index].metadata,
        };
      }

      req.reply({
        statusCode: 200,
        body: { data: credentials[index] },
      });
    }).as('rotateCredential');

  cy.intercept('DELETE', /https?:\/\/[^\s]+\/api\/integrations\/credentials\/.+|\/api\/integrations\/credentials\/.+/, (req) => {
      const id = req.url.split('/').pop() ?? '';
      const index = credentials.findIndex((credential) => credential.id === id);
      if (index >= 0) {
        credentials[index] = {
          ...credentials[index],
          status: 'REVOKED',
        };
      }

      req.reply({
        statusCode: 204,
      });
    }).as('revokeCredential');

  cy.intercept('GET', '**/api/workflows/wf-provider-smoke', {
      statusCode: 200,
      body: {
        data: {
          id: 'wf-provider-smoke',
          name: 'Provider smoke workflow',
          description: 'Validates previews against stored credentials',
          isActive: true,
          steps: [
            {
              id: 'step-1',
              name: 'Prompt step',
              type: 'PROMPT',
              order: 0,
              config: {
                promptContent: 'Say hello to {{name}}',
                models: [
                  {
                    provider: 'openai',
                    model: 'gpt-4o-mini',
                    label: 'Primary OpenAI model',
                  },
                ],
              },
            },
          ],
        },
      },
    }).as('getWorkflow');

  cy.intercept('GET', '**/api/workflows/wf-provider-smoke/executions', {
      statusCode: 200,
      body: { data: [] },
    }).as('getExecutions');
  });

  it('adds, rotates, revokes a credential and reflects status in preview runs', () => {
    cy.visit('/settings/integration-keys', {
      onBeforeLoad: seedAuthSession,
    });
    cy.wait(['@getProfile', '@getProviders', '@getCredentials']);

    cy.findByTestId('integration-keys-add').click();
    cy.findByTestId('integration-keys-form').within(() => {
      cy.findByTestId('integration-keys-provider').select('openai');
      cy.findByTestId('integration-keys-label').clear().type('QA Sandbox');
      cy.findByTestId('integration-keys-secret').clear().type('sk-sandbox-123');
  cy.findByTestId('integration-keys-metadata').clear().type('{"usageTag":"ci"}', { parseSpecialCharSequences: false });
      cy.findByTestId('integration-keys-submit').click();
    });

    cy.wait('@createCredential').its('response.statusCode').should('eq', 201);

    cy.findByTestId('integration-keys-table').contains('QA Sandbox').should('exist');

    cy.visit('/workflows/wf-provider-smoke', {
      onBeforeLoad: seedAuthSession,
    });
    cy.wait(['@getProfile', '@getFeatureFlags', '@getWorkflow', '@getExecutions']);

  cy.intercept('POST', '**/api/workflows/wf-provider-smoke/preview', (req) => {
      expect(req.body.credentials).to.have.property('openai');
      req.reply({
        statusCode: 200,
        body: {
          status: 'COMPLETED',
          usedSampleData: false,
          totalDurationMs: 1280,
          stats: {
            stepsExecuted: 1,
            tokensUsed: 214,
          },
          warnings: [
            `Preview executed with credential ${credentials[0].label}`,
          ],
          stepResults: [],
          finalOutput: {
            generatedText: 'Hello from the OpenAI provider!',
          },
          workflowId: 'wf-provider-smoke',
        },
      });
    }).as('previewWithCredential');

  cy.findByTestId('workflow-preview-button').click();
  // The page fetches credentials again before preview; wait for it to avoid race conditions
  cy.wait('@getCredentials');
  // Placeholder should render immediately with Loading status
  cy.findByTestId('workflow-preview-results', { timeout: 15000 }).should('be.visible');
  cy.findByTestId('workflow-preview-status').should('exist');
  // Now wait for the actual preview response and validate final status
  cy.wait('@previewWithCredential');
  cy.location('pathname').should('contain', '/workflows/wf-provider-smoke');
  cy.contains('[data-testid="workflow-preview-status"]', 'COMPLETED', { timeout: 15000 }).should('be.visible');
    cy.findByTestId('workflow-preview-warnings').should('contain.text', 'QA Sandbox');

    cy.visit('/settings/integration-keys');
    cy.window().then((win) => {
      cy.stub(win, 'prompt').returns('sk-rotated-456');
    });
    cy.findByTestId(`integration-keys-row-${credentials[0].id}`)
      .findByTestId('integration-keys-rotate')
      .click();

    cy.wait('@rotateCredential').its('response.statusCode').should('eq', 200);

    cy.findByTestId(`integration-keys-row-${credentials[0].id}`)
      .should('contain.text', 'active')
      .should('contain.text', credentials[0].label);

    cy.window().then((win) => {
      cy.stub(win, 'confirm').returns(true);
    });
    cy.findByTestId(`integration-keys-row-${credentials[0].id}`)
      .findByTestId('integration-keys-revoke')
      .click();

    cy.wait('@revokeCredential').its('response.statusCode').should('eq', 204);

    cy.findByTestId(`integration-keys-row-${credentials[0].id}`)
      .should('contain.text', 'revoked');

    cy.visit('/workflows/wf-provider-smoke', {
      onBeforeLoad: seedAuthSession,
    });
    cy.wait(['@getProfile', '@getFeatureFlags', '@getWorkflow', '@getExecutions']);

  cy.intercept('POST', '**/api/workflows/wf-provider-smoke/preview', {
      statusCode: 409,
      body: {
        status: 'FAILED',
        usedSampleData: false,
        totalDurationMs: 132,
        stats: {
          stepsExecuted: 0,
          tokensUsed: 0,
        },
        warnings: [
          'Credential revoked. Re-authorise before running this workflow.',
        ],
        workflowId: 'wf-provider-smoke',
        stepResults: [],
        finalOutput: null,
        error: {
          code: 'provider.credentials.revoked',
          message: 'Credential revoked',
        },
      },
    }).as('previewRevoked');

  cy.findByTestId('workflow-preview-button').click();
  cy.wait('@getCredentials');
  cy.findByTestId('workflow-preview-results', { timeout: 15000 }).should('be.visible');
  cy.findByTestId('workflow-preview-status').should('exist');
  cy.wait('@previewRevoked');
  cy.location('pathname').should('contain', '/workflows/wf-provider-smoke');
  cy.contains('[data-testid="workflow-preview-status"]', 'FAILED', { timeout: 15000 }).should('be.visible');
    cy.findByTestId('workflow-preview-warnings').should('contain.text', 'Credential revoked');
  });
});
