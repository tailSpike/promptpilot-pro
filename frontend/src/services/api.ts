import axios from 'axios';

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

// Types
export interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  createdAt: string;
}

export interface Prompt {
  id: string;
  name: string;
  description?: string;
  content: string;
  variables: Variable[];
  metadata: Record<string, any>;
  version: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name?: string;
    email: string;
  };
  _count?: {
    executions: number;
  };
}

export interface Variable {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  description?: string;
  required?: boolean;
  defaultValue?: any;
  options?: string[]; // For select type
}

export interface PromptExecution {
  id: string;
  input: Record<string, any>;
  output: string;
  model: string;
  createdAt: string;
}

export interface CreatePromptData {
  name: string;
  description?: string;
  content: string;
  variables?: Variable[];
  metadata?: Record<string, any>;
  isPublic?: boolean;
}

export interface UpdatePromptData extends Partial<CreatePromptData> {}

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

  executePrompt: async (id: string, variables: Record<string, any>, model?: string) => {
    const response = await api.post(`/prompts/${id}/execute`, { 
      variables, 
      model: model || 'gpt-4' 
    });
    return response.data;
  },
};

export default api;