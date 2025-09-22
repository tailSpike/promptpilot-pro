import request from 'supertest';
import express from 'express';
import cors from 'cors';
import authRoutes from '../../routes/auth';
import promptRoutes from '../../routes/prompts';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/prompts', promptRoutes);

describe('Prompt Routes - Epic 1, Story 1: Structured Prompt Creation', () => {
  let authToken: string;

  beforeEach(async () => {
    // Create and login user for each test
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Prompt Creator',
        email: `promptcreator-${Date.now()}@example.com`,
        password: 'password123'
      });

    authToken = registerResponse.body.token;
  });

  describe('POST /api/prompts - Create Structured Prompt with Variables', () => {
    it('should create a prompt with variables successfully', async () => {
      const promptData = {
        name: 'Welcome Message',
        description: 'A personalized welcome message',
        content: 'Hello {{name}}, welcome to {{platform}}! How can we help you today?',
        variables: [
          {
            name: 'name',
            type: 'text',
            description: 'User name',
            required: true
          },
          {
            name: 'platform',
            type: 'text',
            description: 'Platform name',
            required: true,
            defaultValue: 'PromptPilot Pro'
          }
        ],
        isPublic: false
      };

      const response = await request(app)
        .post('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(promptData)
        .expect(201);

      expect(response.body.prompt).toMatchObject({
        name: promptData.name,
        description: promptData.description,
        content: promptData.content,
        version: 1,
        isPublic: false
      });
      expect(response.body.prompt.variables).toHaveLength(2);
      expect(response.body.prompt.variables[0]).toMatchObject({
        name: 'name',
        type: 'text',
        required: true
      });
    });

    it('should reject prompt creation without authentication', async () => {
      const promptData = {
        name: 'Test Prompt',
        content: 'Hello world!'
      };

      const response = await request(app)
        .post('/api/prompts')
        .send(promptData)
        .expect(401);

      expect(response.body.error.message).toBe('Authentication required');
    });

    it('should reject prompt with missing required fields', async () => {
      const response = await request(app)
        .post('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Incomplete Prompt' })
        .expect(400);

      expect(response.body.error.message).toBe('Name and content are required');
    });
  });

  describe('GET /api/prompts - List User Prompts', () => {
    beforeEach(async () => {
      // Create test prompts
      const prompts = [
        {
          name: 'Email Template',
          content: 'Dear {{recipient}}, {{message}}',
          variables: [{ name: 'recipient', type: 'text' }, { name: 'message', type: 'text' }]
        },
        {
          name: 'Meeting Reminder',
          content: 'Meeting with {{client}} at {{time}}',
          variables: [{ name: 'client', type: 'text' }, { name: 'time', type: 'text' }]
        }
      ];

      for (const prompt of prompts) {
        await request(app)
          .post('/api/prompts')
          .set('Authorization', `Bearer ${authToken}`)
          .send(prompt);
      }
    });

    it('should list user prompts with pagination', async () => {
      const response = await request(app)
        .get('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.prompts).toHaveLength(2);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 2,
        pages: 1
      });
    });

    it('should search prompts by name', async () => {
      const response = await request(app)
        .get('/api/prompts?search=Email')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.prompts).toHaveLength(1);
      expect(response.body.prompts[0].name).toBe('Email Template');
    });
  });

  describe('PUT /api/prompts/:id - Update Prompt', () => {
    let promptId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Original Prompt',
          content: 'Hello {{name}}',
          variables: [{ name: 'name', type: 'text' }]
        });
      promptId = createResponse.body.prompt.id;
    });

    it('should update prompt and increment version', async () => {
      const updateData = {
        name: 'Updated Prompt',
        content: 'Hello {{name}}, welcome to {{platform}}!',
        variables: [
          { name: 'name', type: 'text' },
          { name: 'platform', type: 'text', defaultValue: 'PromptPilot' }
        ]
      };

      const response = await request(app)
        .put(`/api/prompts/${promptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.prompt.name).toBe('Updated Prompt');
      expect(response.body.prompt.version).toBe(2);
      expect(response.body.prompt.variables).toHaveLength(2);
    });
  });

  describe('DELETE /api/prompts/:id - Delete Prompt', () => {
    let promptId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Prompt to Delete',
          content: 'This will be deleted'
        });
      promptId = createResponse.body.prompt.id;
    });

    it('should delete prompt successfully', async () => {
      await request(app)
        .delete(`/api/prompts/${promptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify prompt is deleted
      await request(app)
        .get(`/api/prompts/${promptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});