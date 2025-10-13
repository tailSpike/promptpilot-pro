// Centralized mappings and constants related to providers used across services

// Maps workflow model provider keys to integration provider IDs used by credentials/config UI
// Example: a workflow step that targets provider "azure" should use the integration provider "azure_openai"
export const WORKFLOW_PROVIDER_TO_INTEGRATION_PROVIDER: Record<string, string | null> = {
  openai: 'openai',
  azure: 'azure_openai',
  anthropic: 'anthropic',
  google: 'gemini',
  custom: null,
};

// OpenAI continuation request caps (used when auto-continuing after finish_reason === 'length')
export const OPENAI_CONTINUATION_MAX_SEGMENTS_DEFAULT = 5; // default if env unset
export const OPENAI_CONTINUATION_MAX_SEGMENTS_MIN = 1;     // enforce sensible lower bound
export const OPENAI_CONTINUATION_MAX_SEGMENTS_MAX = 10;    // and a safe upper bound
