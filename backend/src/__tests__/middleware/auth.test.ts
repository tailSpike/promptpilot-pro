import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('jsonwebtoken');
const mockJwt = jwt as jest.Mocked<typeof jwt>;

// Mock Prisma Client
const mockUserFindUnique = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    user: {
      findUnique: mockUserFindUnique
    }
  }))
}));

// Import after mocking
import { authenticate, requireRole } from '../../middleware/auth';

describe('Authentication Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    mockRequest = {
      headers: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
    mockUserFindUnique.mockClear();
    
    // Suppress console.error during tests to avoid noise
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('authenticate', () => {
    it('should authenticate valid token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };

      const mockDecoded = { userId: 'user123' };
      (mockJwt.verify as jest.Mock).mockReturnValue(mockDecoded);

      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        role: 'USER'
      };

      mockUserFindUnique.mockResolvedValue(mockUser);

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject request without token', async () => {
      mockRequest.headers = {};

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: { message: 'Authentication required' }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with malformed authorization header', async () => {
      mockRequest.headers = {
        authorization: 'invalid-header-format'
      };

      // This will be treated as a token and will fail validation
      (mockJwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: { message: 'Invalid token' }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token'
      };

      (mockJwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: { message: 'Invalid token' }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject token for non-existent user', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };

      const mockDecoded = { userId: 'nonexistent-user' };
      (mockJwt.verify as jest.Mock).mockReturnValue(mockDecoded);

      mockUserFindUnique.mockResolvedValue(null);

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: { message: 'Invalid token' }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };

      const mockDecoded = { userId: 'user123' };
      (mockJwt.verify as jest.Mock).mockReturnValue(mockDecoded);

      mockUserFindUnique.mockRejectedValue(new Error('Database error'));

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: { message: 'Invalid token' }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('should allow access for correct role', () => {
      mockRequest.user = { id: 'user123', email: 'test@example.com', role: 'ADMIN' };

      const adminMiddleware = requireRole('ADMIN');
      adminMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny access for incorrect role', () => {
      mockRequest.user = { id: 'user123', email: 'test@example.com', role: 'USER' };

      const adminMiddleware = requireRole('ADMIN');
      adminMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: { message: 'Insufficient permissions' }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access without user', () => {
      delete mockRequest.user;

      const adminMiddleware = requireRole('ADMIN');
      adminMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: { message: 'Authentication required' }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle multiple role checks', () => {
      // Test USER role
      mockRequest.user = { id: 'user123', email: 'test@example.com', role: 'USER' };
      
      const userMiddleware = requireRole('USER');
      userMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      
      // Reset mocks
      jest.clearAllMocks();
      
      // Test ADMIN role requirement with USER role
      const adminMiddleware = requireRole('ADMIN');
      adminMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});