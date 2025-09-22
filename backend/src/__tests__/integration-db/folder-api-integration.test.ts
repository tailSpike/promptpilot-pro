import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import prisma from '../../lib/prisma';
import authRoutes from '../../routes/auth';
import folderRoutes from '../../routes/folders';

describe('Folder API Integration Tests', () => {
  let app: express.Express;
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // Create test app
    app = express();
    app.use(helmet());
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/api/auth', authRoutes);
    app.use('/api/folders', folderRoutes);
    
    // Register a test user and get auth token
    const userData = {
      name: 'Folder API Test User',
      email: `folder-api-test-${Date.now()}@example.com`,
      password: 'testpassword123'
    };

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(userData);

    authToken = registerResponse.body.token;
    testUserId = registerResponse.body.user.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.folder.deleteMany({
      where: { userId: testUserId }
    });
    await prisma.user.delete({
      where: { id: testUserId }
    });
  });

  afterEach(async () => {
    // Clean up folders after each test
    await prisma.folder.deleteMany({
      where: { userId: testUserId }
    });
  });

  describe('POST /api/folders', () => {
    it('should create a new folder successfully', async () => {
      const folderData = {
        name: 'Test Folder',
        description: 'A test folder for API testing',
        color: '#3B82F6'
      };

      const response = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(folderData)
        .expect(201);

      expect(response.body.message).toBe('Folder created successfully');
      expect(response.body.folder).toBeDefined();
      expect(response.body.folder.name).toBe('Test Folder');
      expect(response.body.folder.description).toBe('A test folder for API testing');
      expect(response.body.folder.color).toBe('#3B82F6');
      expect(response.body.folder.userId).toBe(testUserId);
    });

    it('should reject request without authentication', async () => {
      const folderData = {
        name: 'Unauthorized Folder'
      };

      await request(app)
        .post('/api/folders')
        .send(folderData)
        .expect(401);
    });

    it('should reject request with invalid folder name', async () => {
      const folderData = {
        name: '',
        description: 'Empty name test'
      };

      const response = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(folderData)
        .expect(400);

      expect(response.body.error.message).toContain('Folder name is required');
    });

    it('should prevent duplicate folder names in same parent', async () => {
      const folderData = {
        name: 'Duplicate Test'
      };

      // Create first folder
      await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(folderData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(folderData)
        .expect(409);

      expect(response.body.error.message).toContain('already exists in this location');
    });
  });

  describe('GET /api/folders', () => {
    it('should return empty array for user with no folders', async () => {
      const response = await request(app)
        .get('/api/folders')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Folders retrieved successfully');
      expect(response.body.folders).toEqual([]);
    });

    it('should return hierarchical folder structure', async () => {
      // Create parent folder
      const parentResponse = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Parent Folder' });

      const parentId = parentResponse.body.folder.id;

      // Create child folder
      await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          name: 'Child Folder',
          parentId 
        });

      // Get all folders
      const response = await request(app)
        .get('/api/folders')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.folders).toHaveLength(1); // One root folder
      expect(response.body.folders[0].name).toBe('Parent Folder');
      expect(response.body.folders[0].children).toHaveLength(1);
      expect(response.body.folders[0].children[0].name).toBe('Child Folder');
    });
  });

  describe('GET /api/folders/:id', () => {
    it('should return specific folder with contents', async () => {
      // Create a folder
      const folderResponse = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test Folder' });

      const folderId = folderResponse.body.folder.id;

      // Get the folder
      const response = await request(app)
        .get(`/api/folders/${folderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Folder retrieved successfully');
      expect(response.body.folder.id).toBe(folderId);
      expect(response.body.folder.name).toBe('Test Folder');
      expect(response.body.folder.prompts).toBeDefined();
      expect(response.body.folder.children).toBeDefined();
    });

    it('should return 404 for non-existent folder', async () => {
      const response = await request(app)
        .get('/api/folders/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error.message).toContain('not found');
    });
  });

  describe('PUT /api/folders/:id', () => {
    it('should update folder successfully', async () => {
      // Create a folder
      const folderResponse = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Original Name' });

      const folderId = folderResponse.body.folder.id;

      // Update the folder
      const updateData = {
        name: 'Updated Name',
        description: 'Updated description',
        color: '#EF4444'
      };

      const response = await request(app)
        .put(`/api/folders/${folderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.message).toBe('Folder updated successfully');
      expect(response.body.folder.name).toBe('Updated Name');
      expect(response.body.folder.description).toBe('Updated description');
      expect(response.body.folder.color).toBe('#EF4444');
    });

    it('should prevent circular references', async () => {
      // Create parent and child folders
      const parentResponse = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Parent' });

      const childResponse = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          name: 'Child',
          parentId: parentResponse.body.folder.id 
        });

      // Try to make parent a child of child (circular reference)
      const response = await request(app)
        .put(`/api/folders/${parentResponse.body.folder.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ parentId: childResponse.body.folder.id })
        .expect(400);

      expect(response.body.error.message).toContain('circular reference');
    });
  });

  describe('DELETE /api/folders/:id', () => {
    it('should delete empty folder successfully', async () => {
      // Create a folder
      const folderResponse = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'To Delete' });

      const folderId = folderResponse.body.folder.id;

      // Delete the folder
      const response = await request(app)
        .delete(`/api/folders/${folderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Folder deleted successfully');

      // Verify folder is deleted
      await request(app)
        .get(`/api/folders/${folderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should move contents to specified folder when deleting', async () => {
      // Create target folder
      const targetResponse = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Target Folder' });

      // Create folder to delete
      const deleteResponse = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'To Delete' });

      // Create child folder
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _childResponse = await request(app)
        .post('/api/folders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          name: 'Child Folder',
          parentId: deleteResponse.body.folder.id 
        });

      // Delete folder and move contents to target
      await request(app)
        .delete(`/api/folders/${deleteResponse.body.folder.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ moveToFolderId: targetResponse.body.folder.id })
        .expect(200);

      // Verify child folder moved to target
      const targetFolderResponse = await request(app)
        .get(`/api/folders/${targetResponse.body.folder.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(targetFolderResponse.body.folder.children).toHaveLength(1);
      expect(targetFolderResponse.body.folder.children[0].name).toBe('Child Folder');
    });
  });
});