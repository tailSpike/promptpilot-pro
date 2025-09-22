import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Extend Express Request type to include user
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      email: string;
      role: string;
    };
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ 
        error: { message: 'Authentication required' } 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as { userId: string; email: string };
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true
      }
    });

    if (!user) {
      return res.status(401).json({ 
        error: { message: 'Invalid token' } 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ 
      error: { message: 'Invalid token' } 
    });
  }
};

export const requireRole = (role: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: { message: 'Authentication required' } 
      });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ 
        error: { message: 'Insufficient permissions' } 
      });
    }

    next();
  };
};