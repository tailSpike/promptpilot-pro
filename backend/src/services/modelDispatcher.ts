import https from 'https';
import { performance } from 'perf_hooks';
import type { ResolvedIntegrationCredential } from './integrationCredential.service';

export type SupportedProvider = 'openai' | 'azure' | 'anthropic' | 'google' | 'custom';

export interface ModelRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export interface ModelParameters {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  parallelToolCalls?: boolean;
  presencePenalty?: number;
  frequencyPenalty?: number;
  seed?: number;
  responseFormat?: 'json' | 'text';
  metadata?: Record<string, unknown>;
}

export interface ModelConfig {
  id?: string;
  provider: SupportedProvider;
  model: string;
  label?: string;
  parameters?: ModelParameters;
  retry?: ModelRetryOptions;
  disabled?: boolean;
}

export interface ModelRoutingOptions {
  mode?: 'parallel' | 'fallback';
  onError?: 'abort' | 'continue';
  concurrency?: number;
  preferredOrder?: string[];
}

export interface ModelExecutionRequest {
  prompt: string;
  instructions?: string;
  variables?: Record<string, unknown>;
  models: ModelConfig[];
  routing?: ModelRoutingOptions;
}

export interface ModelExecutionResult {
  provider: SupportedProvider;
  model: string;
  label?: string;
  success: boolean;
  outputText?: string;
  tokensUsed?: number;
  promptTokens?: number;
  completionTokens?: number;
  finishReason?: string;
  latencyMs: number;
  warnings: string[];
  raw?: Record<string, unknown> | null;
  error?: string;
  retries: number;
  metadata?: Record<string, unknown>;
}

export interface DispatcherResult {
  results: ModelExecutionResult[];
  aggregatedTokens: number;
}

type ProviderInvocationResult = Omit<ModelExecutionResult, 'latencyMs' | 'retries' | 'warnings'> & {
  warnings?: string[];
};

export interface ModelDispatcherExecuteOptions {
  credentials?: Partial<Record<SupportedProvider, ResolvedIntegrationCredential>>;
}

function getCredentialMetadataString(
  credential: ResolvedIntegrationCredential | undefined,
  key: string,
): string | undefined {
  const metadata = credential?.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }

  const value = metadata[key];
  return typeof value === 'string' ? value : undefined;
}

export class ModelDispatcher {
  constructor(private readonly logger: { warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void } = console) {}

  async execute(request: ModelExecutionRequest, options: ModelDispatcherExecuteOptions = {}): Promise<DispatcherResult> {
    const activeModels = (request.models || []).filter((model) => !model.disabled);
    if (activeModels.length === 0) {
      throw new Error('No active models configured for prompt step.');
    }

    const routingMode = request.routing?.mode ?? 'parallel';
    const orderedModels = this.applyPreferredOrder(activeModels, request.routing?.preferredOrder);

    const results: ModelExecutionResult[] = [];
    const credentialMap = options.credentials ?? {};

    if (routingMode === 'fallback') {
      for (const model of orderedModels) {
        const result = await this.executeWithRetry(
          model,
          request.prompt,
          request.instructions,
          request.variables,
          credentialMap[model.provider],
        );
        results.push(result);

        if (result.success) {
          if (request.routing?.onError !== 'continue') {
            break;
          }
        } else if (request.routing?.onError === 'abort') {
          break;
        }
      }
    } else {
      const concurrency = Math.min(request.routing?.concurrency ?? orderedModels.length, orderedModels.length);
      const queue = orderedModels.slice();
      const parallelResults: ModelExecutionResult[] = [];

      const runNext = async (): Promise<void> => {
        const model = queue.shift();
        if (!model) {
          return;
        }
        const result = await this.executeWithRetry(
          model,
          request.prompt,
          request.instructions,
          request.variables,
          credentialMap[model.provider],
        );
        parallelResults.push(result);
        if (queue.length > 0) {
          await runNext();
        }
      };

      const runners: Promise<void>[] = [];
      for (let i = 0; i < concurrency; i += 1) {
        runners.push(runNext());
      }

      await Promise.all(runners);
      results.push(...parallelResults);
    }

    const aggregatedTokens = results.reduce((total, result) => total + (result.tokensUsed ?? 0), 0);
    return { results, aggregatedTokens };
  }

  private applyPreferredOrder(models: ModelConfig[], preferredOrder?: string[]): ModelConfig[] {
    if (!preferredOrder || preferredOrder.length === 0) {
      return models;
    }

    const map = new Map<string, ModelConfig>();
    models.forEach((model) => {
      if (model.id) {
        map.set(model.id, model);
      }
    });

    const ordered: ModelConfig[] = [];
    preferredOrder.forEach((id) => {
      const candidate = map.get(id);
      if (candidate) {
        ordered.push(candidate);
      }
    });

    models.forEach((model) => {
      if (!ordered.includes(model)) {
        ordered.push(model);
      }
    });

    return ordered;
  }

  private async executeWithRetry(
    model: ModelConfig,
    prompt: string,
    instructions?: string,
    variables?: Record<string, unknown>,
    credential?: ResolvedIntegrationCredential,
  ): Promise<ModelExecutionResult> {
    const maxAttempts = Math.max(1, model.retry?.maxAttempts ?? 2);
    const baseDelay = model.retry?.baseDelayMs ?? 750;
    const maxDelay = model.retry?.maxDelayMs ?? 5000;
    let attempt = 0;
    let lastError: Error | undefined;
    const warnings: string[] = [];

    while (attempt < maxAttempts) {
      attempt += 1;
      const start = performance.now();
      try {
        const response = await this.invokeProvider(model, prompt, instructions, variables, credential);
        const latencyMs = performance.now() - start;
        return {
          ...response,
          latencyMs,
          retries: attempt - 1,
          warnings: [...warnings, ...(response.warnings ?? [])],
        };
      } catch (error: any) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const latencyMs = performance.now() - start;
        warnings.push(`Attempt ${attempt} failed (${latencyMs.toFixed(0)}ms): ${lastError.message}`);

        if (attempt >= maxAttempts) {
          break;
        }

        const jitter = Math.random() * 200;
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1) + jitter, maxDelay);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    const latencyMs = 0;
    return {
      provider: model.provider,
      model: model.model,
      label: model.label,
      success: false,
      latencyMs,
      warnings,
      error: lastError?.message ?? 'Unknown provider error',
      retries: maxAttempts - 1,
    };
  }

  private async invokeProvider(
    model: ModelConfig,
    prompt: string,
    instructions: string | undefined,
    variables: Record<string, unknown> | undefined,
    credential: ResolvedIntegrationCredential | undefined,
  ): Promise<ProviderInvocationResult> {
    switch (model.provider) {
      case 'openai':
        return this.invokeOpenAI(model, prompt, instructions, variables, credential);
      case 'azure':
        return this.invokeAzure(model, prompt, instructions, variables, credential);
      case 'anthropic':
        return this.invokeAnthropic(model, prompt, instructions, variables, credential);
      case 'google':
        return this.invokeGoogle(model, prompt, instructions, variables, credential);
      case 'custom':
        return this.invokeCustom(model, prompt, instructions, variables);
      default:
        throw new Error(`Unsupported provider: ${model.provider}`);
    }
  }

  /**
   * Resolve the max completion tokens to request from the provider.
   * - If the step specifies maxTokens, honor it but raise to MIN_COMPLETION_TOKENS if set and larger.
   * - If unspecified, use DEFAULT_MAX_COMPLETION_TOKENS env var when present, otherwise fall back to a provider-safe default.
   */
  private resolveMaxTokens(stepMaxTokens: number | undefined, providerFallback: number): number | undefined {
    const parseIntSafe = (v: string | undefined): number | undefined => {
      if (!v) return undefined;
      const n = parseInt(v, 10);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };

    const envDefault = parseIntSafe(process.env.DEFAULT_MAX_COMPLETION_TOKENS);
    const envMin = parseIntSafe(process.env.MIN_COMPLETION_TOKENS);

    if (typeof stepMaxTokens === 'number' && Number.isFinite(stepMaxTokens) && stepMaxTokens > 0) {
      const raised = envMin && stepMaxTokens < envMin ? envMin : stepMaxTokens;
      return raised;
    }

    // Unspecified: prefer env default, then provider fallback
    return envDefault ?? providerFallback;
  }

  private async invokeOpenAI(
    model: ModelConfig,
    prompt: string,
    instructions: string | undefined,
    variables: Record<string, unknown> | undefined,
    credential: ResolvedIntegrationCredential | undefined,
  ): Promise<ProviderInvocationResult> {
    const apiKey = credential?.secret ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        provider: model.provider,
        model: model.model,
        label: model.label,
        success: true,
        outputText: this.buildSimulatedResponse('OpenAI', prompt, variables),
        tokensUsed: Math.floor((prompt.length ?? 0) / 4),
        raw: { simulated: true },
        metadata: { warning: 'OPENAI_API_KEY not set; returning simulated output.' },
        warnings: ['OPENAI_API_KEY not set; response simulated.'],
      };
    }

    const organization = getCredentialMetadataString(credential, 'organization') ?? process.env.OPENAI_ORGANIZATION;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };

    if (organization) {
      headers['OpenAI-Organization'] = organization;
    }

    const body: Record<string, unknown> = {
      model: model.model,
      messages: [
        {
          role: 'system',
          content: instructions ?? 'You are a helpful assistant.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: model.parameters?.temperature,
      top_p: model.parameters?.topP,
      // Default to a reasonably high max unless explicitly set; can be controlled via env
      max_tokens: this.resolveMaxTokens(model.parameters?.maxTokens, 2048),
    };

    if (model.parameters?.presencePenalty !== undefined) {
      body.presence_penalty = model.parameters.presencePenalty;
    }

    if (model.parameters?.frequencyPenalty !== undefined) {
      body.frequency_penalty = model.parameters.frequencyPenalty;
    }

    if (model.parameters?.seed !== undefined) {
      body.seed = model.parameters.seed;
    }

    if (model.parameters?.responseFormat) {
      body.response_format = model.parameters.responseFormat === 'json' 
        ? { type: 'json_object' }
        : { type: 'text' };
    }

    // Perform the initial request and, if truncated by length, auto-continue up to a safe cap
    const aggregate: {
      text: string;
      tokens: number;
      promptTokens?: number;
      completionTokens?: number;
      lastFinishReason?: string;
      rawResponses: any[];
      requestIds: string[];
    } = { text: '', tokens: 0, rawResponses: [], requestIds: [] };

    const systemText = (typeof instructions === 'string' && instructions.trim().length > 0)
      ? instructions
      : 'You are a helpful assistant.';
    let messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemText },
      { role: 'user', content: prompt },
    ];

    const continuationCap = Math.max(1, Math.min(10, Number(process.env.OPENAI_CONTINUATION_MAX_SEGMENTS ?? 5)));
    let segments = 0;
    let continueLoop = true;

    while (continueLoop) {
      const requestBody = {
        model: body.model,
        messages,
        temperature: body.temperature,
        top_p: body.top_p,
        max_tokens: body.max_tokens,
        presence_penalty: (body as any).presence_penalty,
        frequency_penalty: (body as any).frequency_penalty,
        seed: (body as any).seed,
        response_format: (body as any).response_format,
      } as Record<string, unknown>;

      const response = await this.httpJsonRequest('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers,
        body: requestBody,
      });

      if (response.statusCode >= 400) {
        const errorMessage = response.body?.error?.message ?? `OpenAI error (${response.statusCode})`;
        console.error('OpenAI API error:', { statusCode: response.statusCode, body: response.body });
        throw new Error(errorMessage);
      }

      // Prefer chat.completions shape, but fallback to generic `output_text` if present (some tests mock this)
      const piece = response.body?.choices?.[0]?.message?.content
        ?? response.body?.output_text
        ?? '';
      const finishReason = response.body?.choices?.[0]?.finish_reason as string | undefined;
      const pieceTotal = Number(response.body?.usage?.total_tokens) || 0;

      aggregate.text += piece;
      aggregate.tokens += pieceTotal;
      // Capture prompt/completion tokens from the first segment; for subsequent segments we add to completion tokens
      if (segments === 0) {
        aggregate.promptTokens = response.body?.usage?.prompt_tokens ?? aggregate.promptTokens;
        aggregate.completionTokens = (aggregate.completionTokens ?? 0) + (response.body?.usage?.completion_tokens ?? 0);
      } else {
        aggregate.completionTokens = (aggregate.completionTokens ?? 0) + (response.body?.usage?.completion_tokens ?? 0);
      }
      aggregate.lastFinishReason = finishReason;
      aggregate.rawResponses.push(response.body);
      if (response.headers['x-request-id']) {
        aggregate.requestIds.push(response.headers['x-request-id']);
      }

      segments += 1;

      // Continue if the model stopped due to max token limit; append the assistant output and a user 'continue' cue
      if (finishReason === 'length' && segments < continuationCap) {
        const sys = messages.find(m => m.role === 'system')?.content ?? systemText;
        const firstUser = messages.find(m => m.role === 'user')?.content ?? prompt;
        messages = [
          { role: 'system', content: sys },
          // Maintain minimal context to encourage continuation
          { role: 'user', content: firstUser },
          { role: 'assistant', content: piece },
          { role: 'user', content: 'continue' },
        ];
        continueLoop = true;
      } else {
        continueLoop = false;
      }
    }

    return {
      provider: model.provider,
      model: model.model,
      label: model.label,
      success: true,
      outputText: aggregate.text,
      tokensUsed: aggregate.tokens || undefined,
      promptTokens: aggregate.promptTokens,
      completionTokens: aggregate.completionTokens,
      finishReason: aggregate.lastFinishReason,
      raw: { segments: aggregate.rawResponses },
      metadata: {
        requestId: aggregate.requestIds.join(', '),
        segments,
        continued: segments > 1,
      },
    };
  }

  private async invokeAzure(
    model: ModelConfig,
    prompt: string,
    instructions: string | undefined,
    variables: Record<string, unknown> | undefined,
    credential: ResolvedIntegrationCredential | undefined,
  ): Promise<ProviderInvocationResult> {
    const endpoint = getCredentialMetadataString(credential, 'endpoint') ?? process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = credential?.secret ?? process.env.AZURE_OPENAI_API_KEY;
    const apiVersion = getCredentialMetadataString(credential, 'apiVersion') ?? process.env.AZURE_OPENAI_API_VERSION ?? '2025-04-01-preview';

    if (!endpoint || !apiKey) {
      return {
        provider: model.provider,
        model: model.model,
        label: model.label,
        success: true,
        outputText: this.buildSimulatedResponse('Azure OpenAI', prompt, variables),
        tokensUsed: Math.floor((prompt.length ?? 0) / 4),
        raw: { simulated: true },
        metadata: { warning: 'AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_API_KEY not set; returning simulated output.' },
        warnings: ['AZURE_OPENAI credentials not set; response simulated.'],
      };
    }

    const deploymentName = getCredentialMetadataString(credential, 'deployment') ?? model.model;
    const baseUrl = endpoint.replace(/\/$/, '');
    const url = `${baseUrl}/openai/deployments/${encodeURIComponent(deploymentName)}/responses?api-version=${encodeURIComponent(apiVersion)}`;

    const headers = {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    };

    const body: Record<string, unknown> = {
      model: model.model,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
          ],
        },
      ],
      temperature: model.parameters?.temperature,
      top_p: model.parameters?.topP,
      max_output_tokens: this.resolveMaxTokens(model.parameters?.maxTokens, 2048),
      metadata: model.parameters?.metadata,
    };

    if (instructions) {
      body.instructions = instructions;
    }

    if (model.parameters?.parallelToolCalls !== undefined) {
      body.parallel_tool_calls = model.parameters.parallelToolCalls;
    }

    const response = await this.httpJsonRequest(url, {
      method: 'POST',
      headers,
      body,
    });

    if (response.statusCode >= 400) {
      const message = response.body?.error?.message ?? `Azure OpenAI error (${response.statusCode})`;
      throw new Error(message);
    }

    const outputText = response.body?.output_text ?? response.body?.output?.[0]?.content?.[0]?.text ?? '';
    const tokensUsed = response.body?.usage?.total_tokens ?? response.body?.usage?.output_tokens;

    return {
      provider: model.provider,
      model: model.model,
      label: model.label,
      success: true,
      outputText,
      tokensUsed,
      raw: response.body,
      metadata: {
        requestId: response.headers['x-request-id'] ?? response.headers['apim-request-id'],
      },
    };
  }

  private async invokeAnthropic(
    model: ModelConfig,
    prompt: string,
    instructions: string | undefined,
    variables: Record<string, unknown> | undefined,
    credential: ResolvedIntegrationCredential | undefined,
  ): Promise<ProviderInvocationResult> {
    const apiKey = credential?.secret ?? process.env.ANTHROPIC_API_KEY;
    const anthropicVersion = getCredentialMetadataString(credential, 'apiVersion') ?? '2023-06-01';
    if (!apiKey) {
      return {
        provider: model.provider,
        model: model.model,
        label: model.label,
        success: true,
        outputText: this.buildSimulatedResponse('Claude', prompt, variables),
        tokensUsed: Math.floor((prompt.length ?? 0) / 5),
        raw: { simulated: true },
        metadata: { warning: 'ANTHROPIC_API_KEY not set; returning simulated output.' },
        warnings: ['ANTHROPIC_API_KEY not set; response simulated.'],
      };
    }

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': anthropicVersion,
    };

    const body = {
      model: getCredentialMetadataString(credential, 'model') ?? model.model,
      max_tokens: this.resolveMaxTokens(model.parameters?.maxTokens, 2048),
      temperature: model.parameters?.temperature,
      top_p: model.parameters?.topP,
      messages: [
        { role: 'user', content: [{ type: 'text', text: prompt }] },
      ],
    };

    const response = await this.httpJsonRequest('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body,
    });

    if (response.statusCode >= 400) {
      const message = response.body?.error?.message ?? response.body?.error ?? `Anthropic error (${response.statusCode})`;
      throw new Error(message);
    }

    const outputText = response.body?.content?.[0]?.text ?? response.body?.content?.[0]?.input_text ?? '';
    const tokensUsed = response.body?.usage?.output_tokens ?? response.body?.usage?.total_tokens;

    return {
      provider: model.provider,
      model: model.model,
      label: model.label,
      success: true,
      outputText,
      tokensUsed,
      raw: response.body,
      metadata: {
        requestId: response.headers['request-id'],
      },
    };
  }

  private async invokeGoogle(
    model: ModelConfig,
    prompt: string,
    instructions: string | undefined,
    variables: Record<string, unknown> | undefined,
    credential: ResolvedIntegrationCredential | undefined,
  ): Promise<ProviderInvocationResult> {
    const apiKey = credential?.secret ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        provider: model.provider,
        model: model.model,
        label: model.label,
        success: true,
        outputText: this.buildSimulatedResponse('Gemini', prompt, variables),
        tokensUsed: Math.floor((prompt.length ?? 0) / 6),
        raw: { simulated: true },
        metadata: { warning: 'GEMINI_API_KEY not set; returning simulated output.' },
        warnings: ['GEMINI_API_KEY not set; response simulated.'],
      };
    }

    // Include API key in both header and query param for compatibility and easier testing
    // (tests assert the presence of the x-goog-api-key header specifically).
    const headers = {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    } as Record<string, string>;

    const generationConfig: Record<string, unknown> = {};
    if (model.parameters?.temperature !== undefined) generationConfig.temperature = model.parameters.temperature;
    if (model.parameters?.topP !== undefined) generationConfig.topP = model.parameters.topP;
    {
      const resolved = this.resolveMaxTokens(model.parameters?.maxTokens, 2048);
      if (resolved !== undefined) generationConfig.maxOutputTokens = resolved;
    }

    const body: Record<string, unknown> = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
          ],
        },
      ],
    };

    if (typeof instructions === 'string' && instructions.trim().length > 0) {
      (body as any).systemInstruction = {
        parts: [{ text: instructions }],
      };
    }

    if (Object.keys(generationConfig).length > 0) {
      body.generationConfig = generationConfig;
    }

    const modelId = getCredentialMetadataString(credential, 'model') ?? model.model;
  const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`);
  // Keep query param as well since it is the primary documented mechanism.
  url.searchParams.set('key', apiKey);
    const response = await this.httpJsonRequest(url.toString(), {
      method: 'POST',
      headers,
      body,
    });

    if (response.statusCode >= 400) {
      const message = response.body?.error?.message ?? `Gemini error (${response.statusCode})`;
      throw new Error(message);
    }

    const outputText = response.body?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const safetyCategories = response.body?.candidates?.[0]?.safetyRatings;
    const tokensUsed = response.body?.usageMetadata?.totalTokenCount ?? response.body?.usageMetadata?.candidatesTokenCount;

    return {
      provider: model.provider,
      model: model.model,
      label: model.label,
      success: true,
      outputText,
      tokensUsed,
      raw: response.body,
      metadata: {
        safetyCategories,
      },
    };
  }

  private async invokeCustom(model: ModelConfig, prompt: string, instructions?: string, variables?: Record<string, unknown>): Promise<ProviderInvocationResult> {
    return {
      provider: model.provider,
      model: model.model,
      label: model.label,
      success: true,
      outputText: this.buildSimulatedResponse(model.label ?? 'Custom model', prompt, variables),
      tokensUsed: Math.floor((prompt.length ?? 0) / 4),
      raw: { simulated: true },
      metadata: { info: 'Custom provider execution not yet implemented.' },
      warnings: ['Custom provider execution returns simulated output by default.'],
    };
  }

  private buildSimulatedResponse(provider: string, prompt: string, variables?: Record<string, unknown>): string {
    const context = Object.keys(variables ?? {}).length > 0 ? ` with variables ${JSON.stringify(variables)}` : '';
    const truncatedPrompt = prompt.length > 80 ? `${prompt.slice(0, 77)}...` : prompt;
    return `[Simulated ${provider} response] ${truncatedPrompt}${context}`;
  }

  private async httpJsonRequest(url: string, options: { method: 'POST' | 'GET'; headers: Record<string, string>; body?: unknown }): Promise<{ statusCode: number; headers: Record<string, string>; body: any; }> {
    const parsedUrl = new URL(url);
    const bodyString = options.body ? JSON.stringify(options.body) : undefined;

    const requestOptions: https.RequestOptions = {
      method: options.method,
      hostname: parsedUrl.hostname,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      headers: {
        ...options.headers,
        'Content-Length': bodyString ? Buffer.byteLength(bodyString).toString() : undefined,
      },
    };

    return new Promise((resolve, reject) => {
      const req = https.request(requestOptions, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk as Buffer));
        res.on('end', () => {
          const rawBody = Buffer.concat(chunks).toString();
          let parsedBody: any = null;
          try {
            parsedBody = rawBody ? JSON.parse(rawBody) : null;
          } catch (error) {
            this.logger.warn('Failed to parse provider response JSON', error);
          }

          const headers: Record<string, string> = {};
          Object.entries(res.headers).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              headers[key] = value.join(', ');
            } else if (value) {
              headers[key] = value;
            }
          });

          resolve({
            statusCode: res.statusCode ?? 0,
            headers,
            body: parsedBody,
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (bodyString) {
        req.write(bodyString);
      }

      req.end();
    });
  }
}

export const modelDispatcher = new ModelDispatcher();