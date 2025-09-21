import request from 'supertest';
import express from 'express';
import cors from 'cors';
import authRoutes from '../../routes/auth';
import promptRoutes from '../../routes/prompts';
import { prisma } from '../test-setup';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/prompts', promptRoutes);

describe('Epic 1, Story 1: Complete User Journey - Create Structured Prompts with Variables', () => {
  let authToken: string;
  let userId: string;

  describe('Complete User Story: "As a user, I want to create structured prompts with variables so I can reuse them across workflows"', () => {
    it('should complete the full user journey for prompt creation and management', async () => {
      const userEmail = `sarah-${Date.now()}@company.com`;
      
      // Step 1: User Registration (Prerequisite)
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Sarah Johnson',
          email: userEmail,
          password: 'securepass123'
        })
        .expect(201);

      expect(registerResponse.body.user.name).toBe('Sarah Johnson');
      expect(registerResponse.body.token).toBeDefined();
      
      authToken = registerResponse.body.token;
      userId = registerResponse.body.user.id;

      // Step 2: User Login (Prerequisite)
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userEmail,
          password: 'securepass123'
        })
        .expect(200);

      expect(loginResponse.body.user.email).toBe(userEmail);

      // Step 3: Create First Structured Prompt with Variables
      const emailPromptData = {
        name: 'Customer Welcome Email',
        description: 'Personalized welcome email for new customers',
        content: `Dear {{customerName}},

Welcome to {{companyName}}! We're excited to have you as part of our community.

Your account has been set up with the following details:
- Email: {{customerEmail}}
- Plan: {{selectedPlan}}
- Start Date: {{startDate}}

{{#if hasDiscount}}
Great news! You've received a {{discountAmount}}% discount on your first month.
{{/if}}

Next steps:
1. Complete your profile setup
2. Explore our {{featureName}} feature
3. Join our community forum

If you have any questions, please don't hesitate to reach out to our support team.

Best regards,
The {{companyName}} Team`,
        variables: [
          {
            name: 'customerName',
            type: 'text',
            description: 'Full name of the customer',
            required: true
          },
          {
            name: 'companyName',
            type: 'text',
            description: 'Company name',
            required: true,
            defaultValue: 'PromptPilot Pro'
          },
          {
            name: 'customerEmail',
            type: 'text',
            description: 'Customer email address',
            required: true
          },
          {
            name: 'selectedPlan',
            type: 'select',
            description: 'Customer subscription plan',
            required: true,
            options: ['Starter', 'Professional', 'Enterprise']
          },
          {
            name: 'startDate',
            type: 'text',
            description: 'Account activation date',
            required: true
          },
          {
            name: 'hasDiscount',
            type: 'boolean',
            description: 'Whether customer has a discount',
            required: false,
            defaultValue: false
          },
          {
            name: 'discountAmount',
            type: 'number',
            description: 'Discount percentage',
            required: false,
            defaultValue: 10
          },
          {
            name: 'featureName',
            type: 'text',
            description: 'Key feature to highlight',
            required: false,
            defaultValue: 'AI-powered workflows'
          }
        ],
        metadata: {
          category: 'email-templates',
          tags: ['customer-onboarding', 'welcome', 'automated'],
          lastModifiedBy: userId
        },
        isPublic: false
      };

      const createPromptResponse = await request(app)
        .post('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(emailPromptData)
        .expect(201);

      const createdPrompt = createPromptResponse.body.prompt;
      expect(createdPrompt.name).toBe('Customer Welcome Email');
      expect(createdPrompt.variables).toHaveLength(8);
      expect(createdPrompt.version).toBe(1);
      expect(createdPrompt.isPublic).toBe(false);

      // Step 4: Verify Variables are Properly Structured
      const requiredVariables = createdPrompt.variables.filter((v: any) => v.required);
      const optionalVariables = createdPrompt.variables.filter((v: any) => !v.required);
      
      expect(requiredVariables).toHaveLength(5);
      expect(optionalVariables).toHaveLength(3);

      // Step 5: Create Second Prompt (Meeting Follow-up)
      const meetingPromptData = {
        name: 'Meeting Follow-up',
        description: 'Template for following up after client meetings',
        content: `Hi {{clientName}},

Thank you for taking the time to meet with {{teamMember}} and me {{meetingDate}} to discuss {{meetingTopic}}.

Key discussion points:
{{discussionPoints}}

Next steps:
{{nextSteps}}

I'll follow up with you by {{followUpDate}} with the {{deliverable}}.

Please let me know if you have any questions or if there's anything else you'd like to discuss.

Best regards,
{{senderName}}`,
        variables: [
          { name: 'clientName', type: 'text', required: true },
          { name: 'teamMember', type: 'text', required: false },
          { name: 'meetingDate', type: 'text', required: true },
          { name: 'meetingTopic', type: 'text', required: true },
          { name: 'discussionPoints', type: 'text', required: true },
          { name: 'nextSteps', type: 'text', required: true },
          { name: 'followUpDate', type: 'text', required: true },
          { name: 'deliverable', type: 'text', required: true },
          { name: 'senderName', type: 'text', required: true }
        ],
        isPublic: false
      };

      const createSecondPromptResponse = await request(app)
        .post('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(meetingPromptData)
        .expect(201);

      // Step 6: List and Verify Both Prompts
      const listPromptsResponse = await request(app)
        .get('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(listPromptsResponse.body.prompts).toHaveLength(2);
      expect(listPromptsResponse.body.pagination.total).toBe(2);

      // Step 7: Search for Specific Prompt
      const searchResponse = await request(app)
        .get('/api/prompts?search=welcome')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(searchResponse.body.prompts).toHaveLength(1);
      expect(searchResponse.body.prompts[0].name).toContain('Welcome');

      // Step 8: Update Prompt to Add New Variable
      const promptId = createdPrompt.id;
      const updateData = {
        variables: [
          ...emailPromptData.variables,
          {
            name: 'supportTeamName',
            type: 'text',
            description: 'Name of the support team',
            required: false,
            defaultValue: 'Customer Success Team'
          }
        ]
      };

      const updateResponse = await request(app)
        .put(`/api/prompts/${promptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.prompt.variables).toHaveLength(9);
      expect(updateResponse.body.prompt.version).toBe(2);

      // Step 9: Verify Prompt Retrieval
      const getPromptResponse = await request(app)
        .get(`/api/prompts/${promptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getPromptResponse.body.prompt.variables).toHaveLength(9);
      expect(getPromptResponse.body.prompt.version).toBe(2);

      // Step 10: Test Pagination
      const paginatedResponse = await request(app)
        .get('/api/prompts?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(paginatedResponse.body.prompts).toHaveLength(1);
      expect(paginatedResponse.body.pagination.pages).toBe(2);

      // Step 11: Verify User Can't Access Other User's Prompts
      // Create another user
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'John Doe',
          email: `john-${Date.now()}@example.com`,
          password: 'password123'
        });

      const otherUserToken = otherUserResponse.body.token;

      // Try to access Sarah's prompts
      const otherUserPromptsResponse = await request(app)
        .get('/api/prompts')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      expect(otherUserPromptsResponse.body.prompts).toHaveLength(0);

      // Step 12: Delete Prompt
      await request(app)
        .delete(`/api/prompts/${promptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify deletion
      const finalListResponse = await request(app)
        .get('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(finalListResponse.body.prompts).toHaveLength(1);
      expect(finalListResponse.body.prompts[0].name).toBe('Meeting Follow-up');
    });

    it('should validate variable types and constraints', async () => {
      // Register user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: `test-${Date.now()}@example.com`,
          password: 'password123'
        });

      const token = registerResponse.body.token;

      // Test with invalid variable structure
      const invalidPromptData = {
        name: 'Invalid Prompt',
        content: 'Hello {{name}}',
        variables: [
          {
            name: 'name',
            type: 'invalid_type', // Invalid type
            required: true
          }
        ]
      };

      const response = await request(app)
        .post('/api/prompts')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidPromptData)
        .expect(400);

      expect(response.body.error.message).toContain('Variable type must be one of');
    });
  });
});