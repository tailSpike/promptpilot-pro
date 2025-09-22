// User types
export interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  createdAt: string;
}

// Variable types
export interface Variable {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  description?: string;
  required?: boolean;
  defaultValue?: string | number | boolean;
  options?: string[]; // For select type
}

// Prompt types
export interface Prompt {
  id: string;
  name: string;
  description?: string;
  content: string;
  variables: Variable[];
  metadata: Record<string, unknown>;
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

export interface PromptExecution {
  id: string;
  input: Record<string, unknown>;
  output: string;
  model: string;
  createdAt: string;
}

export interface CreatePromptData {
  name: string;
  description?: string;
  content: string;
  variables?: Variable[];
  metadata?: Record<string, unknown>;
  isPublic?: boolean;
}

export type UpdatePromptData = Partial<CreatePromptData>;