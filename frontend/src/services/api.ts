import axios from 'axios';
import type { CreatePromptData, UpdatePromptData, CreateFolderData, UpdateFolderData } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
  UpdateFolderData
} from '../types';

// Auth API
export const authAPI = {
  register: async (email: string, password: string, name?: string) => {
    const response = await api.post('/auth/register', { email, password, name });
    return response.data;
  },

  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/auth/me');
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
    const response = await api.get('/prompts', { params });
    return response.data;
  },

  getPrompt: async (id: string) => {
    const response = await api.get(`/prompts/${id}`);
    return response.data;
  },

  createPrompt: async (data: CreatePromptData) => {
    const response = await api.post('/prompts', data);
    return response.data;
  },

  updatePrompt: async (id: string, data: UpdatePromptData) => {
    const response = await api.put(`/prompts/${id}`, data);
    return response.data;
  },

  deletePrompt: async (id: string) => {
    const response = await api.delete(`/prompts/${id}`);
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

// Folders API
export const foldersAPI = {
  getFolders: async () => {
    const response = await api.get('/folders');
    return response.data;
  },

  getFolder: async (id: string) => {
    const response = await api.get(`/folders/${id}`);
    return response.data;
  },

  createFolder: async (data: CreateFolderData) => {
    const response = await api.post('/folders', data);
    return response.data;
  },

  updateFolder: async (id: string, data: UpdateFolderData) => {
    const response = await api.put(`/folders/${id}`, data);
    return response.data;
  },

  deleteFolder: async (id: string, moveToFolderId?: string) => {
    const params = moveToFolderId ? { moveToFolderId } : {};
    const response = await api.delete(`/folders/${id}`, { params });
    return response.data;
  },
};

export default api;