import { ModelDispatcher } from '../../services/modelDispatcher';

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
});
