import request from 'supertest';
import express from 'express';
import cors from 'cors';
import authRoutes from '../../routes/auth';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Routes - Epic 1 User Authentication', () => {
  describe('POST /api/auth/register', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        name: 'Test User',
        email: `test-${Date.now()}@example.com`,
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.name).toBe(userData.name);
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should reject registration with missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: `test-invalid-${Date.now()}@example.com` })
        .expect(400);

      expect(response.body.error.message).toBe('Email and password are required');
    });

    it('should reject duplicate email registration', async () => {
      const userData = {
        name: 'Test User',
        email: `duplicate-${Date.now()}@example.com`,
        password: 'password123'
      };

      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Duplicate registration
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error.message).toBe('User with this email already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    let testEmail: string;

    beforeEach(async () => {
      // Create a unique test user for each test
      testEmail = `login-${Date.now()}@example.com`;
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: testEmail,
          password: 'password123'
        });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'password123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(testEmail);
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.error.message).toBe('Invalid credentials');
    });
  });
});