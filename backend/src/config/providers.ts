export interface IntegrationProviderConfig {
  id: string;
  name: string;
  description: string;
  documentationUrl: string;
  sandbox?: boolean;
  scopes: string[];
  tags?: string[];
}

export const providerRegistry: Record<string, IntegrationProviderConfig> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'Chat Completions, Assistants, and Embeddings APIs from OpenAI.',
    documentationUrl: 'https://platform.openai.com/docs/overview',
    sandbox: true,
    scopes: ['chat.completions', 'responses', 'embeddings'],
    tags: ['recommended', 'general-purpose'],
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Claude family models optimised for fast, high quality reasoning.',
    documentationUrl: 'https://docs.anthropic.com/',
    sandbox: false,
    scopes: ['messages'],
    tags: ['reasoning'],
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Google Gemini multimodal generation APIs.',
    documentationUrl: 'https://ai.google.dev/gemini-api',
    sandbox: false,
    scopes: ['generateContent'],
    tags: ['multimodal'],
  },
  azure_openai: {
    id: 'azure_openai',
    name: 'Azure OpenAI',
    description: 'Microsoft Azure-hosted OpenAI deployments.',
    documentationUrl: 'https://learn.microsoft.com/azure/ai-services/openai/',
    sandbox: false,
    scopes: ['chat.completions', 'embeddings'],
    tags: ['enterprise'],
  },
};

export function listProviders(): IntegrationProviderConfig[] {
  return Object.values(providerRegistry);
}
