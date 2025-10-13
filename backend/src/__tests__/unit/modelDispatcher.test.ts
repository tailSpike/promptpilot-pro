import { ModelDispatcher } from '../../services/modelDispatcher';
import type { ResolvedIntegrationCredential } from '../../services/integrationCredential.service';

describe('ModelDispatcher', () => {
  let dispatcher: ModelDispatcher;

  beforeEach(() => {
    dispatcher = new ModelDispatcher(console);
    jest.spyOn(global.Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('respects preferred order in fallback mode and stops after first success', async () => {
    const spy = jest
      .spyOn(dispatcher as unknown as { invokeProvider: (...args: any[]) => Promise<any> }, 'invokeProvider')
      .mockResolvedValueOnce({
        provider: 'openai',
        model: 'gpt-4o-mini',
        label: 'OpenAI Primary',
        success: true,
        outputText: 'Primary output',
        tokensUsed: 128,
        warnings: [],
        metadata: {},
      });

    const models = [
      { id: 'anthropic', provider: 'anthropic' as const, model: 'claude-3-haiku-20240307', retry: { maxAttempts: 1 } },
      { id: 'openai', provider: 'openai' as const, model: 'gpt-4o-mini', retry: { maxAttempts: 1 } },
    ];

    const result = await dispatcher.execute({
      prompt: 'Hello world',
      models,
      routing: {
        mode: 'fallback',
        preferredOrder: ['openai', 'anthropic'],
      },
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect((spy.mock.calls[0][0] as { id?: string }).id).toBe('openai');
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      provider: 'openai',
      success: true,
      outputText: 'Primary output',
    });
    expect(result.aggregatedTokens).toBe(128);
  });

  it('retries providers according to retry configuration and surfaces warnings', async () => {
    const spy = jest
      .spyOn(dispatcher as unknown as { invokeProvider: (...args: any[]) => Promise<any> }, 'invokeProvider')
      .mockRejectedValueOnce(new Error('Temporary upstream failure'))
      .mockResolvedValueOnce({
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
        success: true,
        outputText: 'Recovered response',
        tokensUsed: 64,
        warnings: [],
        metadata: {},
      });

    const models = [
      {
        id: 'anthropic-primary',
        provider: 'anthropic' as const,
        model: 'claude-3-haiku-20240307',
        retry: { maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0 },
      },
    ];

    const result = await dispatcher.execute({ prompt: 'Retry test', models });

    expect(spy).toHaveBeenCalledTimes(2);
    expect(result.results[0]).toMatchObject({ success: true, retries: 1, tokensUsed: 64 });
    expect(result.results[0].warnings?.[0]).toContain('Attempt 1 failed');
  });

  it('executes all models in parallel mode and aggregates token usage', async () => {
    const callOrder: string[] = [];
    jest
      .spyOn(dispatcher as unknown as { invokeProvider: (...args: any[]) => Promise<any> }, 'invokeProvider')
      .mockImplementation(async (model: { id?: string; provider: string; model: string }) => {
        callOrder.push(model.id ?? `${model.provider}-${model.model}`);
        return {
          provider: model.provider,
          model: model.model,
          success: true,
          outputText: `Response for ${model.model}`,
          tokensUsed: 32,
          warnings: [],
          metadata: {},
        };
      });

    const models = [
      { id: 'openai', provider: 'openai' as const, model: 'gpt-4o-mini', retry: { maxAttempts: 1 } },
      { id: 'anthropic', provider: 'anthropic' as const, model: 'claude-3-haiku-20240307', retry: { maxAttempts: 1 } },
      { id: 'google', provider: 'google' as const, model: 'gemini-1.5-flash', retry: { maxAttempts: 1 } },
    ];

    const result = await dispatcher.execute({
      prompt: 'Parallel mode test',
      models,
      routing: { mode: 'parallel', concurrency: 2 },
    });

    expect(callOrder).toEqual(expect.arrayContaining(['openai', 'anthropic', 'google']));
    expect(result.results).toHaveLength(3);
    expect(result.aggregatedTokens).toBe(32 * 3);
    expect(result.results.every((entry) => entry.success)).toBe(true);
  });

  it('passes resolved provider credentials through execution pipeline', async () => {
    const credential: ResolvedIntegrationCredential = {
      id: 'cred-openai',
      provider: 'openai',
      label: 'Primary',
      secret: 'sk-test-openai',
      metadata: { organization: 'org-test' },
      lastRotatedAt: new Date(),
    };

    const spy = jest
      .spyOn(dispatcher as unknown as { invokeProvider: (...args: any[]) => Promise<any> }, 'invokeProvider')
      .mockResolvedValue({
        provider: 'openai',
        model: 'gpt-4o-mini',
        success: true,
        outputText: 'With credentials',
        tokensUsed: 32,
        warnings: [],
        metadata: {},
      });

    await dispatcher.execute(
      {
        prompt: 'Hello',
        models: [{ id: 'openai', provider: 'openai', model: 'gpt-4o-mini' }],
      },
      { credentials: { openai: credential } },
    );

    expect(spy).toHaveBeenCalledTimes(1);
    const [, , , , receivedCredential] = spy.mock.calls[0];
    expect(receivedCredential).toBe(credential);
  });

  it('uses credential secret and metadata for OpenAI requests', async () => {
    const dispatcherWithSpies = new ModelDispatcher(console);
    const httpSpy = jest
      .spyOn(dispatcherWithSpies as unknown as { httpJsonRequest: (...args: any[]) => Promise<any> }, 'httpJsonRequest')
      .mockResolvedValue({
        statusCode: 200,
        headers: { 'x-request-id': 'req-123' },
        body: {
          output_text: 'Hello world',
          usage: { total_tokens: 64 },
        },
      });

    const credential: ResolvedIntegrationCredential = {
      id: 'cred-openai',
      provider: 'openai',
      label: 'Primary',
      secret: 'sk-live-test',
      metadata: { organization: 'org-live' },
      lastRotatedAt: new Date(),
    };

    const result = await (dispatcherWithSpies as any).invokeOpenAI(
      { provider: 'openai', model: 'gpt-4o-mini' },
      'Prompt text',
      'Instructions',
      { foo: 'bar' },
      credential,
    );

    expect(httpSpy).toHaveBeenCalledTimes(1);
    const [, requestOptions] = httpSpy.mock.calls[0];
    expect(requestOptions.headers.Authorization).toBe('Bearer sk-live-test');
    expect(requestOptions.headers['OpenAI-Organization']).toBe('org-live');
    expect(result).toMatchObject({ success: true, outputText: 'Hello world', tokensUsed: 64 });
  });

  it('derives Azure request parameters from credential metadata', async () => {
    const dispatcherWithSpies = new ModelDispatcher(console);
    const httpSpy = jest
      .spyOn(dispatcherWithSpies as unknown as { httpJsonRequest: (...args: any[]) => Promise<any> }, 'httpJsonRequest')
      .mockResolvedValue({
        statusCode: 200,
        headers: { 'x-request-id': 'azure-req' },
        body: {
          output_text: 'Azure response',
          usage: { total_tokens: 32 },
        },
      });

    const credential: ResolvedIntegrationCredential = {
      id: 'cred-azure',
      provider: 'azure_openai',
      label: 'Azure',
      secret: 'azure-key',
      metadata: {
        endpoint: 'https://example-resource.openai.azure.com',
        deployment: 'gpt-4o-prod',
        apiVersion: '2023-05-15',
      },
      lastRotatedAt: new Date(),
    };

    const result = await (dispatcherWithSpies as any).invokeAzure(
      { provider: 'azure', model: 'gpt-4o-mini' },
      'Azure prompt',
      undefined,
      undefined,
      credential,
    );

    expect(httpSpy).toHaveBeenCalledTimes(1);
    const [url, requestOptions] = httpSpy.mock.calls[0];
    expect(url).toContain('gpt-4o-prod');
    expect(url).toContain('api-version=2023-05-15');
    expect(requestOptions.headers['api-key']).toBe('azure-key');
    expect(result).toMatchObject({ success: true, outputText: 'Azure response' });
  });

  it('applies credential overrides for Anthropic and Gemini providers', async () => {
    const dispatcherWithSpies = new ModelDispatcher(console);

    const anthropicHttpSpy = jest
      .spyOn(dispatcherWithSpies as unknown as { httpJsonRequest: (...args: any[]) => Promise<any> }, 'httpJsonRequest')
      .mockResolvedValueOnce({
        statusCode: 200,
        headers: { 'request-id': 'anthropic-req' },
        body: {
          content: [{ text: 'Anthropic response' }],
          usage: { output_tokens: 40 },
        },
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        headers: {},
        body: {
          candidates: [
            {
              content: { parts: [{ text: 'Gemini response' }] },
              safetyRatings: [],
            },
          ],
          usageMetadata: { totalTokenCount: 28 },
        },
      });

    const anthropicCredential: ResolvedIntegrationCredential = {
      id: 'cred-anthropic',
      provider: 'anthropic',
      label: 'Anthropic',
      secret: 'anthropic-key',
      metadata: { apiVersion: '2023-12-25', model: 'claude-3-haiku-20240307' },
      lastRotatedAt: new Date(),
    };

    const anthropicResult = await (dispatcherWithSpies as any).invokeAnthropic(
      { provider: 'anthropic', model: 'claude-3-opus-20240229' },
      'Anthropic prompt',
      undefined,
      undefined,
      anthropicCredential,
    );

    expect(anthropicHttpSpy).toHaveBeenCalledTimes(1);
    const [, anthropicOptions] = anthropicHttpSpy.mock.calls[0];
    expect(anthropicOptions.headers['x-api-key']).toBe('anthropic-key');
    expect(anthropicOptions.headers['anthropic-version']).toBe('2023-12-25');
    expect((anthropicOptions.body as any).model).toBe('claude-3-haiku-20240307');
    expect(anthropicResult).toMatchObject({ success: true, outputText: 'Anthropic response' });

    const geminiCredential: ResolvedIntegrationCredential = {
      id: 'cred-gemini',
      provider: 'gemini',
      label: 'Gemini',
      secret: 'gemini-secret',
      metadata: { model: 'gemini-2.0-flash' },
      lastRotatedAt: new Date(),
    };

    const geminiResult = await (dispatcherWithSpies as any).invokeGoogle(
      { provider: 'google', model: 'gemini-1.5-pro' },
      'Gemini prompt',
      undefined,
      undefined,
      geminiCredential,
    );

    expect(anthropicHttpSpy).toHaveBeenCalledTimes(2);
    const [geminiUrl, geminiOptions] = anthropicHttpSpy.mock.calls[1];
    expect(geminiUrl).toContain('gemini-2.0-flash');
    expect(geminiOptions.headers['x-goog-api-key']).toBe('gemini-secret');
    expect(geminiResult).toMatchObject({ success: true, outputText: 'Gemini response' });
  });
});
