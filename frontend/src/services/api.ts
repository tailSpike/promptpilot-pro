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
    return response.data;
  },

  getPrompt: async (id: string) => {
    const response = await api.get(`/api/prompts/${id}`);
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
    return response.data;
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
  } = {}) => {
    const response = await api.post(`/api/workflows/${id}/preview`, body);
    return response.data;
  },

  getWorkflowExecutions: async (id: string, params?: {
    limit?: number;
    offset?: number;
  }) => {
    const response = await api.get(`/api/workflows/${id}/executions`, { params });
    return response.data;
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

export default api;