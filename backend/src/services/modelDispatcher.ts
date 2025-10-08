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
      max_output_tokens: model.parameters?.maxTokens,
      metadata: model.parameters?.metadata,
    };

    if (instructions) {
      body.instructions = instructions;
    }

    if (model.parameters?.parallelToolCalls !== undefined) {
      body.parallel_tool_calls = model.parameters.parallelToolCalls;
    }

    const response = await this.httpJsonRequest('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers,
      body,
    });

    if (response.statusCode >= 400) {
      throw new Error(response.body?.error?.message ?? `OpenAI error (${response.statusCode})`);
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
        requestId: response.headers['x-request-id'],
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
      max_output_tokens: model.parameters?.maxTokens,
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
      max_tokens: model.parameters?.maxTokens ?? 1024,
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

    const headers = {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    };

    const generationConfig: Record<string, unknown> = {};
    if (model.parameters?.temperature !== undefined) generationConfig.temperature = model.parameters.temperature;
    if (model.parameters?.topP !== undefined) generationConfig.topP = model.parameters.topP;
    if (model.parameters?.maxTokens !== undefined) generationConfig.maxOutputTokens = model.parameters.maxTokens;

    const body: Record<string, unknown> = {
      contents: [
        {
          parts: [
            { text: prompt },
          ],
        },
      ],
    };

    if (Object.keys(generationConfig).length > 0) {
      body.generationConfig = generationConfig;
    }

  const modelId = getCredentialMetadataString(credential, 'model') ?? model.model;
  const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`);
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