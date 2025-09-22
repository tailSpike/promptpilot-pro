/**
 * Pure Business Logic Tests (Unit Tests)
 * 
 * These tests focus ONLY on business logic functions that do NOT touch the database.
 * No mocking of Prisma is needed because these functions are pure.
 */

// Define variable interface for type safety
interface Variable {
  name: string;
  type: 'text' | 'number' | 'select' | 'multiselect';
  required?: boolean;
  defaultValue?: string;
  options?: string[];
}

// PURE BUSINESS LOGIC FUNCTIONS - NO DATABASE CALLS
const validateVariable = (variable: Variable): boolean | string => {
  if (!variable.name || !variable.type) return 'Name and type are required';
  if (!['text', 'number', 'select', 'multiselect'].includes(variable.type)) return 'Invalid variable type';
  if (variable.type === 'select' && (!variable.options || !Array.isArray(variable.options))) return 'Select variables must have options array';
  return true;
};

const extractVariables = (content: string): string[] => {
  const regex = /\{\{\s*(\w+)\s*\}\}/g;
  const variables: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match[1]) {
      variables.push(match[1]);
    }
  }
  return [...new Set(variables)]; // Remove duplicates
};

const processPromptContent = (content: string, variables: Record<string, any>): string => {
  let processedContent = content;
  
  if (variables && typeof variables === 'object') {
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      processedContent = processedContent.replace(regex, String(value));
    }
  }
  
  return processedContent;
};

const validatePromptData = (data: { name?: string; content?: string; variables?: Variable[] }): string | null => {
  if (!data.name || data.name.trim() === '') return 'Name is required';
  if (!data.content || data.content.trim() === '') return 'Content is required';
  
  if (data.variables) {
    if (!Array.isArray(data.variables)) return 'Variables must be an array';
    
    for (const variable of data.variables) {
      const validation = validateVariable(variable);
      if (validation !== true) return validation as string;
    }
  }
  
  return null;
};

const buildSearchWhereClause = (userId: string, search?: string, isPublic?: string) => {
  const where: Record<string, any> = {
    OR: [
      { userId }, // User's own prompts
      ...(isPublic !== 'false' ? [{ isPublic: true }] : []) // Public prompts (unless explicitly excluded)
    ]
  };

  // Add search filter
  if (search) {
    where.AND = {
      OR: [
        { name: { contains: search } },
        { description: { contains: search } },
        { content: { contains: search } }
      ]
    };
  }

  return where;
};

describe('Prompt Business Logic (Unit Tests)', () => {
  // No setup needed - these are pure functions!

  describe('Variable Validation', () => {
    it('should validate variables correctly', () => {
      const validVariables: Variable[] = [
        { name: 'name', type: 'text', required: true },
        { name: 'age', type: 'number', required: true, defaultValue: '25' },
        { name: 'category', type: 'select', required: true, options: ['A', 'B', 'C'] }
      ];

      validVariables.forEach(variable => {
        expect(validateVariable(variable)).toBe(true);
      });
    });

    it('should reject invalid variables', () => {
      const invalidVariables = [
        { name: 'test', type: 'invalid' as any }, // invalid type
        { name: '', type: 'text' }, // empty name
        { name: 'test', type: 'select' }, // select without options
      ];

      invalidVariables.forEach(variable => {
        expect(validateVariable(variable)).not.toBe(true);
      });
    });
  });

  describe('Variable Extraction', () => {
    it('should extract variables from content', () => {
      const content = 'Hello {{name}}, you are {{age}} years old and live in {{city}}.';
      const variables = extractVariables(content);
      expect(variables).toEqual(expect.arrayContaining(['name', 'age', 'city']));
      expect(variables).toHaveLength(3);
    });

    it('should handle content without variables', () => {
      const content = 'This is a plain text without any variables.';
      const variables = extractVariables(content);
      expect(variables).toEqual([]);
    });

    it('should handle malformed variables', () => {
      const content = 'Hello {name} and {{incomplete and {{valid}}.';
      const variables = extractVariables(content);
      expect(variables).toEqual(['valid']);
    });

    it('should remove duplicate variables', () => {
      const content = 'Hello {{name}}, {{name}} is your name, {{name}}!';
      const variables = extractVariables(content);
      expect(variables).toEqual(['name']);
    });
  });

  describe('Content Processing', () => {
    it('should process variables in content', () => {
      const content = 'Hello {{name}}, welcome to {{platform}}!';
      const variables = { name: 'John', platform: 'PromptPilot' };
      const result = processPromptContent(content, variables);
      expect(result).toBe('Hello John, welcome to PromptPilot!');
    });

    it('should handle missing variables gracefully', () => {
      const content = 'Hello {{name}}, welcome to {{platform}}!';
      const variables = { name: 'John' }; // platform missing
      const result = processPromptContent(content, variables);
      expect(result).toBe('Hello John, welcome to {{platform}}!');
    });

    it('should handle empty variables object', () => {
      const content = 'Hello {{name}}!';
      const result = processPromptContent(content, {});
      expect(result).toBe('Hello {{name}}!');
    });

    it('should convert all values to strings', () => {
      const content = 'Age: {{age}}, Active: {{active}}';
      const variables = { age: 25, active: true };
      const result = processPromptContent(content, variables);
      expect(result).toBe('Age: 25, Active: true');
    });
  });

  describe('Prompt Data Validation', () => {
    it('should validate complete prompt data', () => {
      const validData = {
        name: 'Test Prompt',
        content: 'Hello {{name}}!',
        variables: [
          { name: 'name', type: 'text' as const, required: true }
        ]
      };
      
      expect(validatePromptData(validData)).toBeNull();
    });

    it('should reject prompt data with missing name', () => {
      const invalidData = {
        content: 'Hello {{name}}!'
      };
      
      expect(validatePromptData(invalidData)).toBe('Name is required');
    });

    it('should reject prompt data with empty name', () => {
      const invalidData = {
        name: '   ',
        content: 'Hello {{name}}!'
      };
      
      expect(validatePromptData(invalidData)).toBe('Name is required');
    });

    it('should reject prompt data with missing content', () => {
      const invalidData = {
        name: 'Test Prompt'
      };
      
      expect(validatePromptData(invalidData)).toBe('Content is required');
    });

    it('should validate variables within prompt data', () => {
      const invalidData = {
        name: 'Test Prompt',
        content: 'Hello {{name}}!',
        variables: [
          { name: 'invalid', type: 'badtype' as any }
        ]
      };
      
      expect(validatePromptData(invalidData)).toBe('Invalid variable type');
    });
  });

  describe('Search Where Clause Building', () => {
    it('should build basic where clause for user prompts', () => {
      const result = buildSearchWhereClause('user123');
      expect(result).toEqual({
        OR: [
          { userId: 'user123' },
          { isPublic: true }
        ]
      });
    });

    it('should build where clause with search', () => {
      const result = buildSearchWhereClause('user123', 'email');
      expect(result).toEqual({
        OR: [
          { userId: 'user123' },
          { isPublic: true }
        ],
        AND: {
          OR: [
            { name: { contains: 'email' } },
            { description: { contains: 'email' } },
            { content: { contains: 'email' } }
          ]
        }
      });
    });

    it('should exclude public prompts when requested', () => {
      const result = buildSearchWhereClause('user123', undefined, 'false');
      expect(result).toEqual({
        OR: [
          { userId: 'user123' }
        ]
      });
    });
  });
});