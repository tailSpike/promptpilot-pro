/// <reference types="cypress" />

// End-to-end test that validates Anthropic and Gemini credentials through a real
// prompt-workflow preview execution. Each provider test is self-skipping if
// the corresponding env var is not provided.
//
// Provide credentials via environment variables when running Cypress:
//   - CYPRESS_ANTHROPIC_API_KEY
//   - CYPRESS_GEMINI_API_KEY

type TestUser = { token: string; user: { id: string; email: string; name: string } };

type ProviderResult = { provider?: string; raw?: { simulated?: boolean }; outputText?: string; success?: boolean };
type StepOutput = { providerResults?: ProviderResult[] };
type StepResult = { output?: StepOutput };
type PreviewResponseBody = { status?: string; stepResults?: StepResult[] };

describe('Live provider execution via Integration Keys (Anthropic, Gemini)', () => {
  const apiUrl = Cypress.env('apiUrl') as string;
  let testUser: TestUser;

  const registerTestUser = () => {
    const now = Date.now();
    const userData = {
      name: `Live Providers User ${now}`,
      email: `live-providers-${now}@example.com`,
      password: 'testpassword123',
    };

    return cy
      .request('POST', `${apiUrl}/api/auth/register`, userData)
      .then((response) => {
        testUser = response.body as TestUser;
      });
  };

  const createCredential = (provider: 'anthropic' | 'gemini' | 'openai', secret: string, label: string, metadata?: Record<string, unknown>) => {
    return cy.request({
      method: 'POST',
      url: `${apiUrl}/api/integrations/credentials`,
      headers: { Authorization: `Bearer ${testUser.token}` },
      body: { provider, label, secret, metadata },
    });
  };

  const createWorkflow = (name: string) => {
    return cy
      .request({
        method: 'POST',
        url: `${apiUrl}/api/workflows`,
        headers: { Authorization: `Bearer ${testUser.token}` },
        body: {
          name,
          description: 'Validates live provider execution using Integration Keys',
          isActive: true,
        },
      })
      .then((resp) => resp.body.id as string);
  };

  const addPromptStep = (workflowId: string, model: { provider: 'anthropic' | 'google' | 'openai'; model: string; label: string }) => {
    return cy.request({
      method: 'POST',
      url: `${apiUrl}/api/workflows/${workflowId}/steps`,
      headers: { Authorization: `Bearer ${testUser.token}` },
      body: {
        name: 'Prompt: greet user',
        type: 'PROMPT',
        order: 1,
        config: {
          promptContent: 'Say hello to {{name}}',
          variables: { name: 'friend' },
          models: [model],
          modelRouting: { mode: 'fallback' },
          modelSettings: { temperature: 0.2, maxTokens: 64 },
        },
      },
    });
  };

  const runPreview = (workflowId: string, input: Record<string, unknown>) => {
    return cy.request({
      method: 'POST',
      url: `${apiUrl}/api/workflows/${workflowId}/preview`,
      headers: { Authorization: `Bearer ${testUser.token}` },
      body: { input, useSampleData: false },
      failOnStatusCode: false,
    });
  };

  before(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    return registerTestUser();
  });

  it('Anthropic: uses stored key and returns a non-simulated provider result', function () {
    const ANTHROPIC_API_KEY = Cypress.env('ANTHROPIC_API_KEY') as string | undefined;
    if (!ANTHROPIC_API_KEY) {
      cy.log('ANTHROPIC_API_KEY not set — skipping Anthropic live provider test');
      // Use function() {} with this.skip() for proper Cypress skip semantics
      this.skip();
    }

    const label = `E2E Anthropic ${Date.now()}`;
    const model = { provider: 'anthropic' as const, model: 'claude-3-5-haiku-latest', label: 'Anthropic Haiku' };

    // 1) Save credential
    createCredential('anthropic', ANTHROPIC_API_KEY!, label).then((credResp) => {
      expect(credResp.status, 'credential create status').to.be.oneOf([200, 201]);

      // 2) Create workflow and step
      return createWorkflow(`Anthropic live ${Date.now()}`).then((workflowId) => {
        return addPromptStep(workflowId, model).then((stepResp) => {
          expect(stepResp.status, 'add step status').to.eq(201);

          // 3) Run preview
          return runPreview(workflowId, { name: 'Ada' }).then((previewResp) => {
            expect(previewResp.status, 'preview status').to.eq(200);
            const body = previewResp.body as PreviewResponseBody;
            expect(body).to.have.property('stepResults');
            const first = body.stepResults?.[0];
            expect(first, 'first step result').to.not.equal(undefined);
            const providerResults = first?.output?.providerResults as ProviderResult[] | undefined;
            expect(Array.isArray(providerResults), 'provider results array').to.eq(true);
            const anthropicEntry = (providerResults || []).find((r) => r?.provider === 'anthropic');
            expect(anthropicEntry, 'anthropic result entry').to.not.equal(undefined);
            // Validate that this was a real call (not simulated)
            expect(anthropicEntry?.raw?.simulated, 'anthropic simulated flag').to.not.equal(true);
            // Validate that the provider returned substantive text and success=true
            expect(anthropicEntry?.success, 'anthropic success flag').to.eq(true);
            const anthropicText = (anthropicEntry?.outputText ?? '').trim();
            expect(anthropicText.length, 'anthropic output length').to.be.greaterThan(0);
            // Allow both COMPLETED and FAILED at the top-level due to potential rate limits
            expect(body.status).to.be.oneOf(['COMPLETED', 'FAILED']);
          });
        });
      });
    });
  });

  it('Gemini: uses stored key and returns a non-simulated provider result', function () {
    const GEMINI_API_KEY = Cypress.env('GEMINI_API_KEY') as string | undefined;
    if (!GEMINI_API_KEY) {
      cy.log('GEMINI_API_KEY not set — skipping Gemini live provider test');
      this.skip();
    }

  const label = `E2E Gemini ${Date.now()}`;
  const model = { provider: 'google' as const, model: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' };

    // 1) Save credential
    createCredential('gemini', GEMINI_API_KEY!, label).then((credResp) => {
      expect(credResp.status, 'credential create status').to.be.oneOf([200, 201]);

      // 2) Create workflow and step
      return createWorkflow(`Gemini live ${Date.now()}`).then((workflowId) => {
        return addPromptStep(workflowId, model).then((stepResp) => {
          expect(stepResp.status, 'add step status').to.eq(201);

          // 3) Run preview
          return runPreview(workflowId, { name: 'Grace' }).then((previewResp) => {
            expect(previewResp.status, 'preview status').to.eq(200);
            const body = previewResp.body as PreviewResponseBody;
            expect(body).to.have.property('stepResults');
            const first = body.stepResults?.[0];
            expect(first, 'first step result').to.not.equal(undefined);
            const providerResults = first?.output?.providerResults as ProviderResult[] | undefined;
            expect(Array.isArray(providerResults), 'provider results array').to.eq(true);
            const geminiEntry = (providerResults || []).find((r) => r?.provider === 'google');
            expect(geminiEntry, 'google/gemini result entry').to.not.equal(undefined);
            // Validate that this was a real call (not simulated)
            expect(geminiEntry?.raw?.simulated, 'gemini simulated flag').to.not.equal(true);
            // Validate that the provider returned substantive text and success=true
            expect(geminiEntry?.success, 'gemini success flag').to.eq(true);
            const geminiText = (geminiEntry?.outputText ?? '').trim();
            expect(geminiText.length, 'gemini output length').to.be.greaterThan(0);
            // Allow both COMPLETED and FAILED due to quotas/safety filters
            expect(body.status).to.be.oneOf(['COMPLETED', 'FAILED']);
          });
        });
      });
    });
  });

  it('OpenAI: uses stored key and returns a non-simulated provider result', function () {
    const OPENAI_API_KEY = (Cypress.env('OPENAI_API_KEY') as string | undefined) || (Cypress.env('openai_api_key') as string | undefined);
    if (!OPENAI_API_KEY) {
      cy.log('OPENAI_API_KEY not set — skipping OpenAI live provider test');
      this.skip();
    }

    const label = `E2E OpenAI ${Date.now()}`;
    const model = { provider: 'openai' as const, model: 'gpt-4o-mini', label: 'OpenAI GPT-4o mini' };

    // 1) Save credential
    createCredential('openai', OPENAI_API_KEY!, label).then((credResp) => {
      expect(credResp.status, 'credential create status').to.be.oneOf([200, 201]);

      // 2) Create workflow and step
      return createWorkflow(`OpenAI live ${Date.now()}`).then((workflowId) => {
        return addPromptStep(workflowId, model).then((stepResp) => {
          expect(stepResp.status, 'add step status').to.eq(201);

          // 3) Run preview
          return runPreview(workflowId, { name: 'Linus' }).then((previewResp) => {
            expect(previewResp.status, 'preview status').to.eq(200);
            const body = previewResp.body as PreviewResponseBody;
            expect(body).to.have.property('stepResults');
            const first = body.stepResults?.[0];
            expect(first, 'first step result').to.not.equal(undefined);
            const providerResults = first?.output?.providerResults as ProviderResult[] | undefined;
            expect(Array.isArray(providerResults), 'provider results array').to.eq(true);
            const openaiEntry = (providerResults || []).find((r) => r?.provider === 'openai');
            expect(openaiEntry, 'openai result entry').to.not.equal(undefined);
            // Validate that this was a real call (not simulated)
            expect(openaiEntry?.raw?.simulated, 'openai simulated flag').to.not.equal(true);
            // Validate that the provider returned substantive text and success=true
            expect(openaiEntry?.success, 'openai success flag').to.eq(true);
            const openaiText = (openaiEntry?.outputText ?? '').trim();
            expect(openaiText.length, 'openai output length').to.be.greaterThan(0);
            // Allow both COMPLETED and FAILED due to quotas/safety filters
            expect(body.status).to.be.oneOf(['COMPLETED', 'FAILED']);
          });
        });
      });
    });
  });
});
