import { workflowService } from '../../services/workflowService';
import { modelDispatcher } from '../../services/modelDispatcher';

jest.mock('../../services/modelDispatcher', () => {
  const actual = jest.requireActual('../../services/modelDispatcher');
  return {
    ...actual,
    modelDispatcher: {
      execute: jest.fn(),
    },
  };
});

const mockedDispatcher = modelDispatcher as jest.Mocked<typeof modelDispatcher>;

describe('WorkflowService multi-model prompt execution', () => {
  beforeEach(() => {
    mockedDispatcher.execute.mockReset();
  });

  const baseStep = {
    name: 'Multi Provider Step',
    order: 1,
    type: 'PROMPT',
    prompt: {
      content: 'Hello {{name}}, today is {{day}}.',
      variables: JSON.stringify([
        { name: 'name', defaultValue: 'there' },
        { name: 'day', defaultValue: 'day' },
      ]),
    },
  };

  it('dispatches configured models and merges results', async () => {
    mockedDispatcher.execute.mockResolvedValue({
      results: [
        {
          provider: 'openai',
          model: 'gpt-4o-mini',
          label: 'OpenAI Primary',
          success: true,
          outputText: 'Primary output',
          tokensUsed: 128,
          latencyMs: 320,
          retries: 0,
          warnings: [],
        },
        {
          provider: 'anthropic',
          model: 'claude-3-haiku-20240307',
          label: 'Claude Backup',
          success: true,
          outputText: 'Secondary output',
          tokensUsed: 256,
          latencyMs: 410,
          retries: 0,
          warnings: ['Used default temperature'],
        },
      ],
      aggregatedTokens: 384,
    });

    const input = { name: 'Ada', day: 'Friday' };
    const config = {
      instructions: 'Be concise and friendly.',
      multiModelEnabled: true,
      models: [
        { id: 'openai-primary', provider: 'openai', model: 'gpt-4o-mini' },
        { id: 'anthropic-fallback', provider: 'anthropic', model: 'claude-3-haiku-20240307' },
      ],
      modelRouting: {
        mode: 'parallel',
        concurrency: 2,
      },
    };

    const result = await (workflowService as any).executePromptStep(baseStep, input, config);

    expect(mockedDispatcher.execute).toHaveBeenCalledTimes(1);
    const dispatcherPayload = mockedDispatcher.execute.mock.calls[0][0];
    expect(dispatcherPayload.prompt).toBe('Hello Ada, today is Friday.');
    expect(dispatcherPayload.instructions).toBe('Be concise and friendly.');
    expect(dispatcherPayload.models).toHaveLength(2);
    expect(result.generatedText).toBe('Primary output');
    expect(result.tokens).toBe(384);
    expect(result.primaryProvider).toBe('openai');
    expect(result.providerResults).toHaveLength(2);
    expect(result.resolvedVariables.name).toBe('Ada');
  });

  it('falls back to single model when multi-model is disabled', async () => {
    mockedDispatcher.execute.mockResolvedValue({
      results: [
        {
          provider: 'anthropic',
          model: 'claude-3-haiku-20240307',
          success: true,
          outputText: 'Fallback output',
          latencyMs: 210,
          retries: 0,
        },
      ],
      aggregatedTokens: 64,
    });

    const input = { name: 'Grace', day: 'Monday' };
    const config = {
      multiModelEnabled: false,
      modelSettings: {
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
        temperature: 0.4,
        maxTokens: 600,
      },
    };

    const result = await (workflowService as any).executePromptStep(baseStep, input, config);

    expect(mockedDispatcher.execute).toHaveBeenCalledTimes(1);
    const dispatcherPayload = mockedDispatcher.execute.mock.calls[0][0];
    expect(dispatcherPayload.models).toEqual([
      expect.objectContaining({ provider: 'anthropic', model: 'claude-3-haiku-20240307' }),
    ]);
    expect(result.primaryProvider).toBe('anthropic');
    expect(result.generatedText).toBe('Fallback output');
  });

  it('supports inline prompt content when no prompt record is attached', async () => {
    mockedDispatcher.execute.mockResolvedValue({
      results: [
        {
          provider: 'google',
          model: 'gemini-2.0-flash',
          success: true,
          outputText: 'Inline output',
          tokensUsed: 42,
          latencyMs: 180,
          retries: 0,
          warnings: [],
        },
      ],
      aggregatedTokens: 42,
    });

    const inlineStep = {
      name: 'Inline Step',
      order: 1,
      type: 'PROMPT',
    };

    const config = {
      promptContent: 'Explain {{topic}} in {{style}} style.',
      variables: {
        style: 'bullet point',
      },
      models: [{ id: 'gemini-inline', provider: 'google', model: 'gemini-2.0-flash' }],
      modelRouting: {
        mode: 'parallel',
      },
    };

    const input = { topic: 'unit testing' };

    const result = await (workflowService as any).executePromptStep(inlineStep, input, config);

    expect(mockedDispatcher.execute).toHaveBeenCalledTimes(1);
    const dispatcherPayload = mockedDispatcher.execute.mock.calls[0][0];
    expect(dispatcherPayload.prompt).toBe('Explain unit testing in bullet point style.');
    expect(result.generatedText).toBe('Inline output');
    expect(result.resolvedVariables).toMatchObject({ topic: 'unit testing', style: 'bullet point' });
  });

  it('executes prompt step with inline config via executeStep when no prompt record exists', async () => {
    mockedDispatcher.execute.mockResolvedValue({
      results: [
        {
          provider: 'openai',
          model: 'gpt-4o-mini',
          success: true,
          outputText: 'Inline step output',
          latencyMs: 120,
          retries: 0,
          warnings: [],
        },
      ],
      aggregatedTokens: 32,
    });

    const step = {
      name: 'Inline Execute Step',
      type: 'PROMPT',
      order: 1,
      prompt: null,
      config: JSON.stringify({
        promptContent: 'Tell me about {{subject}}',
        models: [{ id: 'openai-inline', provider: 'openai', model: 'gpt-4o-mini' }],
      }),
    };

    const result = await (workflowService as any).executeStep(step, { subject: 'science' });

    expect(mockedDispatcher.execute).toHaveBeenCalledTimes(1);
    expect(result.generatedText).toBe('Inline step output');
  });

  it('falls back to simulated output during preview when providers fail with auth errors', async () => {
    mockedDispatcher.execute.mockResolvedValue({
      results: [
        {
          provider: 'anthropic',
          model: 'claude-3-haiku-20240307',
          label: 'Claude',
          success: false,
          outputText: undefined,
          tokensUsed: 0,
          latencyMs: 140,
          retries: 1,
          warnings: [],
          error: 'invalid x-api-key',
        },
      ],
      aggregatedTokens: 0,
    });

    const step = {
      ...baseStep,
      name: 'Auth Failure Step',
      config: JSON.stringify({
        models: [{ id: 'anthropic-preview', provider: 'anthropic', model: 'claude-3-haiku-20240307' }],
      }),
    };

    const result = await (workflowService as any).executeStep(step, { name: 'Preview User', day: 'Tuesday' }, { allowSimulatedFallback: true });

    expect(mockedDispatcher.execute).toHaveBeenCalledTimes(1);
    expect(result.generatedText).toContain('Simulated');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('authentication'),
      ]),
    );
    expect(result.providerResults).toHaveLength(2);
    const simulatedEntry = result.providerResults.find((entry: any) => entry.raw?.simulated === true);
    expect(simulatedEntry).toBeDefined();
    expect(simulatedEntry.success).toBe(true);
  });

  it('executes prompt step when config is already an object', async () => {
    mockedDispatcher.execute.mockResolvedValue({
      results: [
        {
          provider: 'openai',
          model: 'gpt-4o-mini',
          success: true,
          outputText: 'Object config output',
          tokensUsed: 99,
          latencyMs: 150,
          retries: 0,
          warnings: [],
        },
      ],
      aggregatedTokens: 99,
    });

    const step = {
      name: 'Object Config Step',
      type: 'PROMPT',
      order: 1,
      prompt: {
        content: 'Answer for {{subject}}',
        variables: JSON.stringify([{ name: 'subject', defaultValue: 'science' }]),
      },
      config: {
        models: [{ id: 'openai-object', provider: 'openai', model: 'gpt-4o-mini' }],
        modelRouting: { mode: 'parallel' },
      },
    };

    const result = await (workflowService as any).executeStep(step, { subject: 'history' });

    expect(mockedDispatcher.execute).toHaveBeenCalledTimes(1);
    expect(result.generatedText).toBe('Object config output');
  });

  it('throws when all configured models fail', async () => {
    mockedDispatcher.execute.mockResolvedValue({
      results: [
        {
          provider: 'openai',
          model: 'gpt-4o-mini',
          success: false,
          error: 'Upstream timeout',
          latencyMs: 0,
          retries: 2,
          warnings: ['Timed out twice'],
        },
      ],
      aggregatedTokens: 0,
    });

    const failingConfig = {
      multiModelEnabled: true,
      models: [{ id: 'openai-only', provider: 'openai', model: 'gpt-4o-mini' }],
      modelRouting: {
        mode: 'fallback',
      },
    };

    await expect(
      (workflowService as any).executePromptStep(
        { ...baseStep, name: 'Failure Step' },
        { name: 'User', day: 'Sunday' },
        failingConfig,
      ),
    ).rejects.toThrow('Prompt step "Failure Step" failed: Upstream timeout');
  });
});