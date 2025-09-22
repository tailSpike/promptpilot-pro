import express from 'express';
import prisma from '../lib/prisma';
import { AuthService, validateRegisterData, validateLoginData } from '../services/auth.service';

const router = express.Router();
const authService = new AuthService(prisma);

// Register new user
router.post('/register', async (req, res) => {
  try {
    // Validate input data (pure business logic)
    const userData = validateRegisterData(req.body);

    // Use service layer for business logic
    const result = await authService.registerUser(userData);

    res.status(201).json({
      message: 'User created successfully',
      ...result
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    const message = error instanceof Error ? error.message : 'Failed to create user';
    const statusCode = message.includes('already exists') ? 400 : 500;
    
    res.status(statusCode).json({ 
      error: { message } 
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    // Validate input data (pure business logic)
    const userData = validateLoginData(req.body);

    // Use service layer for business logic
    const result = await authService.loginUser(userData);

    res.json({
      message: 'Login successful',
      ...result
    });
  } catch (error) {
    console.error('Login error:', error);
    
    const message = error instanceof Error ? error.message : 'Login failed';
    const statusCode = message.includes('Invalid credentials') ? 401 : 500;
    
    res.status(statusCode).json({ 
      error: { message } 
    });
  }
});

// Get current user profile
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: { message: 'No token provided' } 
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Use service layer for token verification
    const decoded = authService.verifyToken(token);
    
    // Get user profile
    const user = await authService.getUserById(decoded.userId);

    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    
    const message = error instanceof Error ? error.message : 'Authentication failed';
    const statusCode = message.includes('not found') ? 404 : 401;
    
    res.status(statusCode).json({ 
      error: { message } 
    });
  }
});

export default router;