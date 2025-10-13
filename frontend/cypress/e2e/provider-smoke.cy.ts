// Provider smoke tests that can be run locally via Cypress.
// These tests will SKIP when the required env vars are not present to avoid false failures.
// Provide sandbox/non-production keys via Cypress env (e.g., CYPRESS_OPENAI_API_KEY) when you want to run them.

type OpenAIModelsResponse = {
  data?: Array<{ id: string }>;
};

type GeminiModelsResponse = {
  models?: Array<{ name: string }>
};

describe('Provider Smoke - External Connectivity (optional)', () => {
  type ReportEntry = {
    provider: 'openai' | 'anthropic' | 'gemini' | 'azure-openai';
    ran: boolean;
    status?: number;
    durationMs?: number;
    tokens?: { input?: number; output?: number };
    reason?: string;
    extra?: { modelsCount?: number; deploymentsCount?: number; apiVersion?: string };
  };
  const report: { entries: ReportEntry[] } = { entries: [] };

  it('OpenAI: list models returns 200 (skips if no key)', () => {
    const key = Cypress.env('OPENAI_API_KEY') as string | undefined;
    if (!key) {
      cy.log('OPENAI_API_KEY not set — skipping OpenAI smoke test');
      report.entries.push({ provider: 'openai', ran: false, reason: 'OPENAI_API_KEY missing' });
      return;
    }

    const started = Date.now();
    cy.request<OpenAIModelsResponse>({
      method: 'GET',
      url: 'https://api.openai.com/v1/models',
      headers: {
        Authorization: `Bearer ${key}`,
      },
      failOnStatusCode: false, // surface status in assertion below
    }).then((resp) => {
      expect(resp.status, `OpenAI status code`).to.eq(200);
      expect(resp.body && Array.isArray(resp.body.data), 'OpenAI models array').to.eq(true);
      report.entries.push({
        provider: 'openai',
        ran: true,
        status: resp.status,
        durationMs: Date.now() - started,
        extra: { modelsCount: Array.isArray(resp.body?.data) ? resp.body.data.length : undefined },
      });
    });
  });

  it('Anthropic: tiny messages call returns 200 (skips if no key)', () => {
    const key = Cypress.env('ANTHROPIC_API_KEY') as string | undefined;
    if (!key) {
      cy.log('ANTHROPIC_API_KEY not set — skipping Anthropic smoke test');
      report.entries.push({ provider: 'anthropic', ran: false, reason: 'ANTHROPIC_API_KEY missing' });
      return;
    }

    const started = Date.now();
    cy.request({
      method: 'POST',
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: {
        model: 'claude-3-5-haiku-latest',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      },
      failOnStatusCode: false,
    }).then((resp) => {
      expect(resp.status, `Anthropic status code`).to.eq(200);
      // Response typically includes id/model/content
      expect(resp.body).to.have.property('model');
      const usage = resp.body?.usage;
      report.entries.push({
        provider: 'anthropic',
        ran: true,
        status: resp.status,
        durationMs: Date.now() - started,
        tokens: usage ? { input: usage.input_tokens, output: usage.output_tokens } : undefined,
      });
    });
  });

  it('Google Gemini: list models returns 200 (skips if no key)', () => {
    const key = Cypress.env('GEMINI_API_KEY') as string | undefined;
    if (!key) {
      cy.log('GEMINI_API_KEY not set — skipping Gemini smoke test');
      report.entries.push({ provider: 'gemini', ran: false, reason: 'GEMINI_API_KEY missing' });
      return;
    }

    const started = Date.now();
    cy.request<GeminiModelsResponse>({
      method: 'GET',
      url: `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
      failOnStatusCode: false,
    }).then((resp) => {
      expect(resp.status, `Gemini status code`).to.eq(200);
      expect(resp.body && Array.isArray(resp.body.models), 'Gemini models array').to.eq(true);
      report.entries.push({
        provider: 'gemini',
        ran: true,
        status: resp.status,
        durationMs: Date.now() - started,
        extra: { modelsCount: Array.isArray(resp.body?.models) ? resp.body.models.length : undefined },
      });
    });
  });

  it('Azure OpenAI: list deployments returns 200 (skips if no key or endpoint)', () => {
    const apiKey = Cypress.env('AZURE_OPENAI_API_KEY') as string | undefined;
    const endpoint = Cypress.env('AZURE_OPENAI_ENDPOINT') as string | undefined; // e.g., https://your-resource.openai.azure.com
    const apiVersion = Cypress.env('AZURE_OPENAI_API_VERSION') as string | undefined;
    if (!apiKey || !endpoint) {
      cy.log('AZURE_OPENAI_API_KEY or AZURE_OPENAI_ENDPOINT not set — skipping Azure OpenAI smoke test');
      report.entries.push({ provider: 'azure-openai', ran: false, reason: 'AZURE_OPENAI_API_KEY or AZURE_OPENAI_ENDPOINT missing' });
      return;
    }
    const version = apiVersion || '2024-02-15-preview';

    const started = Date.now();
    cy.request({
      method: 'GET',
      url: `${endpoint.replace(/\/$/, '')}/openai/deployments?api-version=${encodeURIComponent(version)}`,
      headers: {
        'api-key': apiKey,
      },
      failOnStatusCode: false,
    }).then((resp) => {
      expect(resp.status, `Azure OpenAI status code`).to.eq(200);
      // ARM-style list often returns { value: [...] }
      expect(resp.body).to.have.property('value');
      expect(Array.isArray(resp.body.value), 'Azure deployments array').to.eq(true);
      report.entries.push({
        provider: 'azure-openai',
        ran: true,
        status: resp.status,
        durationMs: Date.now() - started,
        extra: { deploymentsCount: Array.isArray(resp.body?.value) ? resp.body.value.length : undefined, apiVersion: version },
      });
    });
  });

  after(() => {
    // Build a concise Markdown summary for GitHub Job Summary
    const lines: string[] = [];
    lines.push('# Provider Smoke Summary');
    lines.push('');
    lines.push('| Provider | Ran | Status | Duration (ms) | Tokens (in/out) | Notes |');
    lines.push('|---|---:|---:|---:|---:|---|');
    report.entries.forEach((e) => {
      const ran = e.ran ? 'yes' : 'no';
      const status = e.status ?? '-';
      const dur = e.durationMs ?? '-';
      const tokens = e.tokens ? `${e.tokens.input ?? '-'} / ${e.tokens.output ?? '-'}` : '-';
      const notes = e.reason || (e.extra?.modelsCount != null ? `models=${e.extra.modelsCount}` : e.extra?.deploymentsCount != null ? `deployments=${e.extra.deploymentsCount};v=${e.extra.apiVersion}` : '');
      lines.push(`| ${e.provider} | ${ran} | ${status} | ${dur} | ${tokens} | ${notes} |`);
    });
    const md = lines.join('\n');
    cy.writeFile('cypress/results/provider-smoke-summary.md', md, { log: false });
  });
});
