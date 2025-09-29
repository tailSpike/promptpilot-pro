import request from 'supertest';
import { app } from '../../index';
import { createPrismaClient } from '../../lib/prisma';
import jwt from 'jsonwebtoken';

const prisma = createPrismaClient();

describe('Workflow API', () => {
  let authToken: string;
  let userId: string;
  let testWorkflowId: string;

  beforeAll(async () => {
    // Create a test user and get auth token
    const testUser = await prisma.user.create({
      data: {
        email: 'workflow-test@example.com',
        name: 'Workflow Test User',
        password: 'hashedpassword',
        role: 'USER'
      }
    });

    userId = testUser.id;
    authToken = jwt.sign(
      { 
        userId: testUser.id, 
        email: testUser.email, 
        role: testUser.role 
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.workflowExecution.deleteMany({ where: { workflow: { userId } } });
    await prisma.workflowStep.deleteMany({ where: { workflow: { userId } } });
    await prisma.workflow.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { email: 'workflow-test@example.com' } });
    await prisma.$disconnect();
  });

  describe('POST /api/workflows', () => {
    it('should create a new workflow', async () => {
      const workflowData = {
        name: 'Test Workflow',
        description: 'A test workflow for API testing',
        tags: ['test', 'api']
      };

      const response = await request(app)
        .post('/api/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send(workflowData)
        .expect(201);

      expect(response.body.name).toBe(workflowData.name);
      expect(response.body.description).toBe(workflowData.description);
      expect(response.body.version).toBe('1.0.0');
      expect(response.body.isActive).toBe(true);
      expect(response.body.userId).toBe(userId);

      testWorkflowId = response.body.id;
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
      expect(response.body.details).toBeDefined();
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/workflows')
        .send({ name: 'Test' })
        .expect(401);
    });
  });

  describe('GET /api/workflows', () => {
    it('should list user workflows', async () => {
      const response = await request(app)
        .get('/api/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.workflows).toBeInstanceOf(Array);
      expect(response.body.total).toBeGreaterThanOrEqual(1);
      expect(response.body.pagination).toBeDefined();

      const workflow = response.body.workflows.find((w: any) => w.id === testWorkflowId);
      expect(workflow).toBeDefined();
      expect(workflow.name).toBe('Test Workflow');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/workflows?limit=1&offset=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.workflows.length).toBeLessThanOrEqual(1);
      expect(response.body.pagination.limit).toBe(1);
    });

    it('should support search', async () => {
      const response = await request(app)
        .get('/api/workflows?search=Test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const workflows = response.body.workflows;
      expect(workflows.length).toBeGreaterThanOrEqual(1);
      workflows.forEach((workflow: any) => {
        expect(workflow.name.toLowerCase()).toContain('test');
      });
    });
  });

  describe('GET /api/workflows/:id', () => {
    it('should get a specific workflow', async () => {
      const response = await request(app)
        .get(`/api/workflows/${testWorkflowId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(testWorkflowId);
      expect(response.body.name).toBe('Test Workflow');
      expect(response.body.description).toBe('A test workflow for API testing');
      expect(response.body.userId).toBe(userId);
      expect(response.body.steps).toBeInstanceOf(Array);
      expect(response.body.user).toBeDefined();
      expect(response.body.executions).toBeInstanceOf(Array);
    });

    it('should return 404 for non-existent workflow', async () => {
      await request(app)
        .get('/api/workflows/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PUT /api/workflows/:id', () => {
    it('should update a workflow', async () => {
      const updateData = {
        name: 'Updated Test Workflow',
        description: 'Updated description',
        tags: ['updated', 'test']
      };

      const response = await request(app)
        .put(`/api/workflows/${testWorkflowId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.id).toBe(testWorkflowId);
      expect(response.body.name).toBe(updateData.name);
      expect(response.body.description).toBe(updateData.description);
      expect(response.body.userId).toBe(userId);
    });

    it('should return 404 for non-existent workflow', async () => {
      await request(app)
        .put('/api/workflows/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated' })
        .expect(404);
    });
  });

  describe('POST /api/workflows/:id/steps', () => {
    it('should add a step to workflow', async () => {
      const stepData = {
        name: 'Test Step',
        type: 'TRANSFORM' as const,
        order: 0,
        config: {
          transformations: {
            'input': { type: 'uppercase' }
          }
        }
      };

      const response = await request(app)
        .post(`/api/workflows/${testWorkflowId}/steps`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(stepData)
        .expect(201);

      expect(response.body.name).toBe(stepData.name);
      expect(response.body.type).toBe(stepData.type);
      expect(response.body.order).toBe(stepData.order);
      expect(response.body.workflowId).toBe(testWorkflowId);
    });

    it('should validate step data', async () => {
      const response = await request(app)
        .post(`/api/workflows/${testWorkflowId}/steps`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Invalid Step' }) // Missing required fields
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
    });
  });

  describe('POST /api/workflows/:id/preview', () => {
    beforeAll(async () => {
      await prisma.workflowVariable.deleteMany({ where: { workflowId: testWorkflowId } });
      if (testWorkflowId) {
        await prisma.workflowVariable.create({
          data: {
            workflowId: testWorkflowId,
            name: 'input',
            type: 'input',
            dataType: 'string',
            defaultValue: 'sample payload',
            isRequired: true,
          }
        });
      }
    });

    afterAll(async () => {
      await prisma.workflowVariable.deleteMany({ where: { workflowId: testWorkflowId } });
    });

    it('should preview a workflow using generated sample data', async () => {
      const response = await request(app)
        .post(`/api/workflows/${testWorkflowId}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ useSampleData: true })
        .expect(200);

      expect(response.body.workflowId).toBe(testWorkflowId);
      expect(response.body.status).toBe('COMPLETED');
      expect(response.body.usedSampleData).toBe(true);
      expect(response.body.stepResults).toBeInstanceOf(Array);
      expect(response.body.stepResults.length).toBeGreaterThan(0);
      expect(response.body.stepResults[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should surface validation errors when inputs are missing', async () => {
      const response = await request(app)
        .post(`/api/workflows/${testWorkflowId}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ useSampleData: false, input: {} })
        .expect(400);

      expect(response.body.error).toContain('Preview failed');
      expect(response.body.error).toContain('Required variable');
    });
  });

  describe('POST /api/workflows/:id/execute', () => {
    it('should execute a workflow', async () => {
      const executionData = {
        input: {
          message: 'Hello World',
          user: 'Test User'
        },
        triggerType: 'manual'
      };

      const response = await request(app)
        .post(`/api/workflows/${testWorkflowId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(executionData)
        .expect(201);

      expect(response.body.workflowId).toBe(testWorkflowId);
      expect(response.body.status).toBe('PENDING');
      expect(response.body.id).toBeDefined();
      expect(JSON.parse(response.body.input)).toEqual(executionData.input);
    });

    it('should validate execution data', async () => {
      const response = await request(app)
        .post(`/api/workflows/${testWorkflowId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({}) // Missing input
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
    });
  });

  describe('GET /api/workflows/:id/executions', () => {
    it('should get execution history', async () => {
      // Wait a moment for the execution to potentially complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await request(app)
        .get(`/api/workflows/${testWorkflowId}/executions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.executions).toBeInstanceOf(Array);
      expect(response.body.total).toBeGreaterThanOrEqual(1);
      expect(response.body.pagination).toBeDefined();

      if (response.body.executions.length > 0) {
        const execution = response.body.executions[0];
        expect(execution.workflowId).toBe(testWorkflowId);
        expect(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED']).toContain(execution.status);
      }
    });
  });

  describe('DELETE /api/workflows/:id', () => {
    it('should delete a workflow', async () => {
      const response = await request(app)
        .delete(`/api/workflows/${testWorkflowId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Workflow deleted successfully');

      // Verify deletion
      await request(app)
        .get(`/api/workflows/${testWorkflowId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent workflow', async () => {
      await request(app)
        .delete('/api/workflows/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});