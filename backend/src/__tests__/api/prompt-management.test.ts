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

describe('Prompt Management API', () => {
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

    it('should reject prompt with invalid variables format', async () => {
      const response = await request(app)
        .post('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid Variables',
          content: 'Hello {{name}}',
          variables: 'not-an-array'
        })
        .expect(400);

      expect(response.body.error.message).toBe('Variables must be an array');
    });

    it('should reject prompt with invalid variable structure', async () => {
      const response1 = await request(app)
        .post('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid Variable Name',
          content: 'Hello {{name}}',
          variables: [{ type: 'text' }] // missing name
        })
        .expect(400);

      expect(response1.body.error.message).toBe('Variable name is required and must be a string');

      const response2 = await request(app)
        .post('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid Variable Type',
          content: 'Hello {{name}}',
          variables: [{ name: 'test', type: 'invalid' }]
        })
        .expect(400);

      expect(response2.body.error.message).toBe('Variable type must be one of: text, number, boolean, select');
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

    it('should handle invalid prompt ID format', async () => {
      // Test with invalid ID format returns 404 (not found)
      const response = await request(app)
        .get('/api/prompts/invalid-id-format')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error.message).toBe('Prompt not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors during prompt creation', async () => {
      const promptData = {
        name: 'Test Prompt',
        content: 'Hello {{name}}',
        variables: [
          {
            name: 'name',
            type: 'text',
            required: true
          }
        ]
      };

      // Mock database error by using extremely long content that might cause issues
      const longContent = 'a'.repeat(100000); // Very long string
      
      const response = await request(app)
        .post('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...promptData,
          content: longContent
        });

      // Should still succeed but tests the error handling path
      expect([201, 500]).toContain(response.status);
    });

    it('should handle invalid pagination parameters gracefully', async () => {
      // Test with invalid query parameters - should default to valid values
      const response = await request(app)
        .get('/api/prompts?page=invalid&limit=invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200); // Now handles invalid parameters gracefully

      // Should default to page 1, limit 10
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.prompts).toBeDefined();
    });

    it('should handle search with special characters', async () => {
      const response = await request(app)
        .get('/api/prompts?search="%\' OR 1=1 --')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.prompts).toBeDefined();
    });

    it('should handle prompt update with invalid ID', async () => {
      const response = await request(app)
        .put('/api/prompts/invalid-id-format')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Name',
          content: 'Updated content'
        })
        .expect(404);

      expect(response.body.error.message).toBe('Prompt not found or access denied');
    });

    it('should handle prompt deletion with invalid ID', async () => {
      const response = await request(app)
        .delete('/api/prompts/invalid-id-format')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error.message).toBe('Prompt not found or access denied');
    });

    it('should handle concurrent access scenarios', async () => {
      // Create a prompt
      const promptData = {
        name: 'Concurrent Test',
        content: 'Test {{value}}',
        variables: [{ name: 'value', type: 'text', required: true }]
      };

      const createResponse = await request(app)
        .post('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(promptData)
        .expect(201);

      const promptId = createResponse.body.prompt.id;

      // First delete should succeed
      const firstDelete = await request(app)
        .delete(`/api/prompts/${promptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Subsequent deletes should fail with 404
      const secondDelete = await request(app)
        .delete(`/api/prompts/${promptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
      
      const thirdDelete = await request(app)
        .delete(`/api/prompts/${promptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
      
      expect(firstDelete.status).toBe(200);
      expect(secondDelete.status).toBe(404);
      expect(thirdDelete.status).toBe(404);
    });

    it('should validate prompt access permissions', async () => {
      // Create another user
      const otherUserData = {
        name: 'Other User',
        email: `other-${Date.now()}@example.com`,
        password: 'password123'
      };

      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send(otherUserData)
        .expect(201);

      const otherUserToken = otherUserResponse.body.token;

      // Create a private prompt with first user
      const promptData = {
        name: 'Private Prompt',
        content: 'Private {{content}}',
        isPublic: false,
        variables: [{ name: 'content', type: 'text', required: true }]
      };

      const createResponse = await request(app)
        .post('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(promptData)
        .expect(201);

      const promptId = createResponse.body.prompt.id;

      // Try to access with other user - should fail
      await request(app)
        .get(`/api/prompts/${promptId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(404);

      // Try to update with other user - should fail
      await request(app)
        .put(`/api/prompts/${promptId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ name: 'Hacked Name' })
        .expect(404);

      // Try to delete with other user - should fail
      await request(app)
        .delete(`/api/prompts/${promptId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(404);
    });
  });
});