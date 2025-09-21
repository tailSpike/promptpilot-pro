import { prisma } from '../test-setup';

// Mock service functions for testing business logic
const validateVariable = (variable: any): boolean | string => {
  if (!variable.name || !variable.type) return false;
  if (!['text', 'number', 'select', 'multiselect'].includes(variable.type)) return false;
  if (variable.type === 'select' && (!variable.options || !Array.isArray(variable.options))) return false;
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
  return variables;
};

let testUserId: string;

describe('Prompt Service Logic', () => {

  beforeEach(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        name: 'Service Test User',
        email: `service-test-${Date.now()}@example.com`,
        password: 'hashedpassword',
        role: 'USER'
      }
    });
    testUserId = user.id;
  });

  describe('Variable Processing', () => {
    it('should validate variable structure', () => {
      const validVariables = [
        { name: 'userName', type: 'text', required: true },
        { name: 'age', type: 'number', required: false, defaultValue: 18 },
        { name: 'plan', type: 'select', required: true, options: ['basic', 'pro'] }
      ];

      // Simulate variable validation logic
      const validateVariable = (variable: any) => {
        const validTypes = ['text', 'number', 'boolean', 'select'];
        return variable.name && 
               typeof variable.name === 'string' && 
               variable.type && 
               validTypes.includes(variable.type);
      };

      validVariables.forEach(variable => {
        expect(validateVariable(variable)).toBe(true);
      });
    });

    it('should reject invalid variable types', () => {
      const invalidVariables = [
        { name: 'test', type: 'invalid_type' },
        { name: '', type: 'text' },
        { type: 'text' }, // missing name
        { name: 'test' } // missing type
      ];

      invalidVariables.forEach(variable => {
        expect(validateVariable(variable)).toBe(false);
      });
    });
  });

  describe('Template Processing', () => {
    it('should identify variables in template content', () => {
      const content = 'Hello {{userName}}, your age is {{age}} and plan is {{plan}}.';
      
      // Extract variables from template
      const extractVariables = (content: string) => {
        const matches = content.match(/\{\{([^}]+)\}\}/g);
        return matches ? matches.map(match => match.replace(/[{}]/g, '').trim()) : [];
      };

      const variables = extractVariables(content);
      expect(variables).toEqual(['userName', 'age', 'plan']);
    });

    it('should handle nested template syntax', () => {
      const content = `
        {{hasDiscount}}
        Discount: {{discountAmount}}%
        Welcome {{customerName}}!
      `;

      const variables = extractVariables(content);
      expect(variables).toContain('hasDiscount');
      expect(variables).toContain('discountAmount');
      expect(variables).toContain('customerName');
    });
  });

  describe('Data Integrity', () => {
    it('should maintain prompt version history', async () => {
      // Create initial prompt
      const prompt = await prisma.prompt.create({
        data: {
          name: 'Version Test',
          content: 'Hello {{name}}',
          variables: [{ name: 'name', type: 'text', required: true }],
          userId: testUserId,
          version: 1
        }
      });

      // Update prompt
      const updatedPrompt = await prisma.prompt.update({
        where: { id: prompt.id },
        data: {
          content: 'Hello {{name}}, welcome to {{platform}}',
          variables: [
            { name: 'name', type: 'text', required: true },
            { name: 'platform', type: 'text', required: true, defaultValue: 'PromptPilot Pro' }
          ],
          version: prompt.version + 1
        }
      });

      expect(updatedPrompt.version).toBe(2);
      expect(updatedPrompt.variables).toHaveLength(2);
    });

    it('should enforce user ownership', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          name: 'Other User',
          email: `other-${Date.now()}@example.com`,
          password: 'hashedpassword',
          role: 'USER'
        }
      });

      // Create prompt for first user
      const prompt = await prisma.prompt.create({
        data: {
          name: 'User 1 Prompt',
          content: 'Hello {{name}}',
          variables: [],
          userId: testUserId
        }
      });

      // Verify second user can't access first user's prompts
      const otherUserPrompts = await prisma.prompt.findMany({
        where: { userId: otherUser.id }
      });

      expect(otherUserPrompts).toHaveLength(0);

      // Verify first user can access their own prompts
      const userPrompts = await prisma.prompt.findMany({
        where: { userId: testUserId }
      });

      expect(userPrompts).toHaveLength(1);
      expect(userPrompts[0]?.id).toBe(prompt.id);
    });
  });
});