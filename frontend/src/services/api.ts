import axios from 'axios';
import type {
  CreatePromptData,
  UpdatePromptData,
  CreateFolderData,
  UpdateFolderData,
  FeatureFlags,
  PromptLibraryShare,
  SharedLibrarySummary,
  UserSummary,
  Prompt,
  PromptComment,
  PromptCommentsResult,
  IntegrationCredential,
  IntegrationCredentialStatus,
  IntegrationProviderConfig,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Create axios instance with CORS support
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Enable cookies/credentials for CORS
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Detect Cypress to route certain calls via a relative base URL so cy.intercept('/api/...') works reliably
let IS_CYPRESS = false;
try {
  IS_CYPRESS = typeof window !== 'undefined' && 'Cypress' in window;
} catch {
  IS_CYPRESS = false;
}

// Dedicated clients that play well with Cypress route stubs (relative baseURL)
// Fallback to the main API base for normal runtime.
let integrationsApiClient: typeof api = api;
try {
  if (IS_CYPRESS) {
    integrationsApiClient = axios.create({
      baseURL: '',
      withCredentials: false,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    }) as typeof api;
  }
} catch {
  // ignore env detection errors
}

// --- Helpers to normalize backend DTOs into UI-friendly shapes ---
function isVariableLike(v: unknown): v is import('../types').Variable {
  return (
    typeof v === 'object' && v !== null &&
    typeof (v as { name?: unknown }).name === 'string' &&
    typeof (v as { type?: unknown }).type === 'string'
  );
}

function coerceVariable(v: unknown): import('../types').Variable | null {
  if (!isVariableLike(v)) return null;
  const { name } = v as { name: string };
  const rawType = (v as { type: unknown }).type;
  const finalType: import('../types').Variable['type'] =
    rawType === 'text' || rawType === 'number' || rawType === 'boolean' || rawType === 'select'
      ? rawType
      : 'text';
  const variable: import('../types').Variable = {
    name,
    type: finalType,
  };
  if (typeof (v as { description?: unknown }).description === 'string') {
    variable.description = (v as { description: string }).description;
  }
  if (typeof (v as { required?: unknown }).required === 'boolean') {
    variable.required = (v as { required: boolean }).required;
  }
  const dv = (v as { defaultValue?: unknown }).defaultValue;
  if (['string', 'number', 'boolean'].includes(typeof dv)) {
    variable.defaultValue = dv as string | number | boolean;
  }
  const opts = (v as { options?: unknown }).options;
  if (Array.isArray(opts) && opts.every((o) => typeof o === 'string')) {
    variable.options = opts as string[];
  }
  return variable;
}

function normalizeVariablesValue(value: unknown): import('../types').Variable[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(coerceVariable).filter((v): v is import('../types').Variable => v !== null);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return normalizeVariablesValue(parsed);
    } catch {
      return [];
    }
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown> & { items?: unknown; variables?: unknown };
    const items = Array.isArray(obj.items)
      ? obj.items
      : Array.isArray(obj.variables)
        ? obj.variables
        : [];
    return normalizeVariablesValue(items);
  }
  return [];
}

function normalizePrompt<T extends Partial<Prompt>>(prompt: T): T {
  if (!prompt) return prompt;
  const normalized = { ...prompt } as T & { variables?: unknown };
  const coerced = normalizeVariablesValue(normalized.variables);
  (normalized as Partial<Prompt>).variables = coerced;
  return normalized as T;
}

const AUTH_REDIRECT_EXCLUSIONS = ['/api/auth/login', '/api/auth/register'];

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl: string = error.config?.url ?? '';
      const shouldSkipRedirect = AUTH_REDIRECT_EXCLUSIONS.some((endpoint) => requestUrl.endsWith(endpoint));

      if (shouldSkipRedirect) {
        return Promise.reject(error);
      }

      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Re-export types for convenience
export type { 
  User, 
  Variable, 
  Prompt, 
  PromptExecution, 
  CreatePromptData, 
  UpdatePromptData,
  Folder,
  CreateFolderData,
  UpdateFolderData,
  FeatureFlags,
  PromptLibraryShare,
  SharedLibrarySummary,
  UserSummary,
  PromptComment,
  PromptCommentsResult,
  IntegrationCredential,
  IntegrationCredentialStatus,
  IntegrationProviderConfig,
} from '../types';

// Auth API
export const authAPI = {
  register: async (email: string, password: string, name?: string) => {
    const response = await api.post('/api/auth/register', { email, password, name });
    return response.data;
  },

  login: async (email: string, password: string) => {
    const response = await api.post('/api/auth/login', { email, password });
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },
};

// Prompts API
export const promptsAPI = {
  getPrompts: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    isPublic?: boolean;
    folderId?: string;
  }) => {
    const response = await api.get('/api/prompts', { params });
    if (response.data && Array.isArray(response.data.prompts)) {
      response.data.prompts = response.data.prompts.map((p: Prompt) => normalizePrompt(p));
    }
    return response.data;
  },

  getPrompt: async (id: string) => {
    const response = await api.get(`/api/prompts/${id}`);
    if (response.data && response.data.prompt) {
      response.data.prompt = normalizePrompt(response.data.prompt);
    }
    return response.data;
  },

  createPrompt: async (data: CreatePromptData) => {
    const response = await api.post('/api/prompts', data);
    return response.data;
  },

  updatePrompt: async (id: string, data: UpdatePromptData) => {
    const response = await api.put(`/api/prompts/${id}`, data);
    return response.data;
  },

  deletePrompt: async (id: string) => {
    const response = await api.delete(`/api/prompts/${id}`);
    return response.data;
  },

  executePrompt: async (id: string, variables: Record<string, unknown>, model?: string) => {
    const response = await api.post(`/prompts/${id}/execute`, { 
      variables, 
      model: model || 'gpt-4' 
    });
    return response.data;
  },
};

export const featureFlagsAPI = {
  getFlags: async (): Promise<FeatureFlags> => {
    const response = await api.get('/api/feature-flags');
    return response.data.flags ?? {};
  },
};

export const libraryShareAPI = {
  shareLibrary: async (libraryId: string, inviteeEmail: string) => {
    const response = await api.post(`/api/libraries/${libraryId}/shares`, { inviteeEmail });
    return response.data;
  },

  getLibraryShares: async (libraryId: string): Promise<{ shares: PromptLibraryShare[] }> => {
    const response = await api.get(`/api/libraries/${libraryId}/shares`);
    return response.data;
  },

  revokeShare: async (libraryId: string, shareId: string) => {
    const response = await api.delete(`/api/libraries/${libraryId}/shares/${shareId}`);
    return response.data;
  },

  getSharedWithMe: async (): Promise<{ shares: SharedLibrarySummary[] }> => {
    const response = await api.get('/api/libraries/shared-with-me');
    return response.data;
  },

  getLibraryDetails: async (
    libraryId: string,
  ): Promise<{
    library: {
      id: string;
      name: string;
      owner: UserSummary;
      promptCount: number;
      updatedAt: string;
    };
  }> => {
    const response = await api.get(`/api/libraries/${libraryId}`);
    return response.data;
  },

  getLibraryPrompts: async (libraryId: string): Promise<{ prompts: Prompt[] }> => {
    const response = await api.get(`/api/libraries/${libraryId}/prompts`);
    return response.data;
  },
};

export const promptCommentsAPI = {
  list: async (promptId: string): Promise<PromptCommentsResult> => {
    const response = await api.get(`/api/prompts/${promptId}/comments`);
    return response.data;
  },

  create: async (promptId: string, body: string): Promise<PromptComment> => {
    const response = await api.post(`/api/prompts/${promptId}/comments`, { body });
    return response.data.comment;
  },

  delete: async (commentId: string): Promise<void> => {
    await api.delete(`/api/comments/${commentId}`);
  },
};

export const usersAPI = {
  searchMembers: async (query: string): Promise<{ users: UserSummary[] }> => {
    const response = await api.get('/api/users/search', { params: { q: query } });
    return response.data;
  },
};

// Folders API
export const foldersAPI = {
  getFolders: async () => {
    const response = await api.get('/api/folders');
    return response.data;
  },

  getFolder: async (id: string) => {
    const response = await api.get(`/api/folders/${id}`);
    return response.data;
  },

  createFolder: async (data: CreateFolderData) => {
    const response = await api.post('/api/folders', data);
    return response.data;
  },

  updateFolder: async (id: string, data: UpdateFolderData) => {
    const response = await api.put(`/api/folders/${id}`, data);
    return response.data;
  },

  deleteFolder: async (id: string, moveToFolderId?: string) => {
    const params = moveToFolderId ? { moveToFolderId } : {};
    const response = await api.delete(`/api/folders/${id}`, { params });
    return response.data;
  },

  reorderFolders: async (parentId: string | null, folderIds: string[]) => {
    const response = await api.post('/api/folders/reorder', { parentId, folderIds });
    return response.data;
  },

  insertFolderAtPosition: async (folderId: string, targetParentId: string | null, position: number) => {
    const response = await api.post('/api/folders/insert-at-position', { 
      folderId, 
      targetParentId, 
      position 
    });
    return response.data;
  },
};

// Versions API
export const versionsAPI = {
  getVersionHistory: async (promptId: string) => {
    const response = await api.get(`/api/prompts/${promptId}/versions`);
    return response.data.data; // Extract the actual versions array from { success: true, data: versions }
  },

  getVersionStats: async (promptId: string) => {
    const response = await api.get(`/api/prompts/${promptId}/versions/stats`);
    return response.data.data; // Extract the actual stats from { success: true, data: stats }
  },

  revertToVersion: async (promptId: string, versionId: string) => {
    const response = await api.put(`/api/prompts/${promptId}/revert/${versionId}`);
    return response.data.data; // Extract the actual data from { success: true, data: ... }
  },

  compareVersions: async (promptId: string, version1: string, version2: string) => {
    const response = await api.get(`/api/prompts/${promptId}/versions/compare`, {
      params: { version1, version2 }
    });
    return response.data.data; // Extract the actual comparison data from { success: true, data: ... }
  },
};

// Workflows API
export const workflowsAPI = {
  getWorkflows: async (params?: {
    folderId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) => {
    const response = await api.get('/api/workflows', { params });
    return response.data;
  },

  getWorkflow: async (id: string) => {
    const response = await api.get(`/api/workflows/${id}`);
    const data = response.data;
    return data?.data ?? data;
  },

  createWorkflow: async (data: {
    name: string;
    description?: string;
    folderId?: string;
    tags?: string[];
    isActive?: boolean;
  }) => {
    const response = await api.post('/api/workflows', data);
    return response.data;
  },

  updateWorkflow: async (id: string, data: {
    name?: string;
    description?: string;
    folderId?: string;
    tags?: string[];
    isActive?: boolean;
  }) => {
    const response = await api.put(`/api/workflows/${id}`, data);
    return response.data;
  },

  deleteWorkflow: async (id: string) => {
    const response = await api.delete(`/api/workflows/${id}`);
    return response.data;
  },

  executeWorkflow: async (id: string, input: Record<string, unknown> = {}, triggerType = 'manual') => {
    const response = await api.post(`/api/workflows/${id}/execute`, { input, triggerType });
    return response.data;
  },

  previewWorkflow: async (id: string, body: {
    input?: Record<string, unknown>;
    useSampleData?: boolean;
    triggerType?: string;
    simulateOnly?: boolean;
  } = {}) => {
    const response = await api.post(`/api/workflows/${id}/preview`, body);
    return response.data;
  },

  getWorkflowExecutions: async (id: string, params?: {
    limit?: number;
    offset?: number;
  }) => {
    const response = await api.get(`/api/workflows/${id}/executions`, { params });
    const data = response.data;
    return data?.data ?? data;
  },

  getWorkflowExecution: async (workflowId: string, executionId: string) => {
    const response = await api.get(`/api/workflows/${workflowId}/executions/${executionId}`);
    return response.data;
  },

  // Workflow Step Management
  createStep: async (workflowId: string, stepData: {
    name: string;
    type: 'PROMPT' | 'CONDITION' | 'TRANSFORM' | 'DELAY' | 'WEBHOOK' | 'DECISION';
    order: number;
    config: Record<string, unknown>;
    promptId?: string;
    inputs?: Record<string, unknown>;
    outputs?: Record<string, unknown>;
    conditions?: Record<string, unknown>;
  }) => {
    const response = await api.post(`/api/workflows/${workflowId}/steps`, stepData);
    return response.data;
  },

  updateStep: async (workflowId: string, stepId: string, stepData: {
    name?: string;
    type?: 'PROMPT' | 'CONDITION' | 'TRANSFORM' | 'DELAY' | 'WEBHOOK' | 'DECISION';
    order?: number;
    config?: Record<string, unknown>;
    promptId?: string;
    inputs?: Record<string, unknown>;
    outputs?: Record<string, unknown>;
    conditions?: Record<string, unknown>;
  }) => {
    const response = await api.put(`/api/workflows/${workflowId}/steps/${stepId}`, stepData);
    return response.data;
  },

  deleteStep: async (workflowId: string, stepId: string) => {
    const response = await api.delete(`/api/workflows/${workflowId}/steps/${stepId}`);
    return response.data;
  },

  reorderSteps: async (workflowId: string, stepIds: string[]) => {
    const response = await api.put(`/api/workflows/${workflowId}/steps/reorder`, { stepIds });
    return response.data;
  },
};

export const integrationsAPI = {
  getProviders: async (): Promise<{ providers: IntegrationProviderConfig[] }> => {
    const response = await integrationsApiClient.get('/api/integrations/providers');
    const data = response.data;
    const providers: IntegrationProviderConfig[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.providers)
        ? data.providers
        : Array.isArray(data?.data)
          ? data.data
          : [];
    return { providers };
  },

  getCredentials: async (): Promise<{ credentials: IntegrationCredential[] }> => {
    const response = await integrationsApiClient.get('/api/integrations/credentials');
    const data = response.data;
    const credentials: IntegrationCredential[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.credentials)
        ? data.credentials
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.data?.credentials)
            ? data.data.credentials
            : [];
    return { credentials };
  },

  createCredential: async (payload: {
    provider: string;
    label: string;
    secret: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ credential: IntegrationCredential }> => {
    const response = await integrationsApiClient.post('/api/integrations/credentials', payload);
    return response.data;
  },

  updateCredential: async (
    credentialId: string,
    payload: {
      secret?: string;
      label?: string;
      status?: IntegrationCredentialStatus;
      metadata?: Record<string, unknown>;
    },
  ): Promise<{ credential: IntegrationCredential }> => {
    const response = await integrationsApiClient.patch(`/api/integrations/credentials/${credentialId}`, payload);
    return response.data;
  },

  revokeCredential: async (credentialId: string): Promise<{ credential: IntegrationCredential }> => {
    const response = await integrationsApiClient.delete(`/api/integrations/credentials/${credentialId}`);
    return response.data;
  },
};

export default api;