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
  folderId?: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name?: string;
    email: string;
  };
  folder?: {
    id: string;
    name: string;
    color?: string;
  };
  accessScope?: 'owned' | 'shared' | 'public';
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
  folderId?: string | null;
}

export type UpdatePromptData = Partial<CreatePromptData> & {
  changeType?: 'PATCH' | 'MINOR' | 'MAJOR';
  commitMessage?: string;
};

// Folder types
export interface Folder {
  id: string;
  name: string;
  description?: string;
  color?: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  children?: Folder[];
  _count?: {
    prompts: number;
    children: number;
  };
}

export interface CreateFolderData {
  name: string;
  description?: string;
  color?: string;
  parentId?: string;
  sortOrder?: number;
}

export interface UpdateFolderData {
  name?: string;
  description?: string | null;
  color?: string | null;
  parentId?: string | null;
  sortOrder?: number;
}

export interface FeatureFlags {
  [flag: string]: boolean;
}

export interface UserSummary {
  id: string;
  email: string;
  name?: string;
}

export interface PromptLibraryShare {
  id: string;
  folderId: string;
  invitedUserId: string;
  invitedById: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  invitedUser: UserSummary;
  invitedBy: UserSummary;
  folder: {
    id: string;
    name: string;
    updatedAt: string;
  };
}

export interface SharedLibrarySummary {
  id: string;
  createdAt: string;
  folder: {
    id: string;
    name: string;
    updatedAt: string;
    user: UserSummary;
  };
  invitedBy: UserSummary;
}