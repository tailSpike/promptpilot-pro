import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

export interface RegisterUserData {
  email: string;
  password: string;
  name?: string;
}

export interface LoginUserData {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
  token: string;
}

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  async registerUser(userData: RegisterUserData): Promise<AuthResponse> {
    const { email, password, name } = userData;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null
      }
    });

    // Generate JWT
    const token = this.generateToken(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    };
  }

  async loginUser(userData: LoginUserData): Promise<AuthResponse> {
    const { email, password } = userData;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Generate JWT
    const token = this.generateToken(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    };
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };
  }

  private generateToken(userId: string, email: string): string {
    return jwt.sign(
      { userId, email },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );
  }

  verifyToken(token: string): { userId: string; email: string } {
    try {
      const decoded = jwt.verify(
        token, 
        process.env.JWT_SECRET || 'fallback-secret'
      ) as { userId: string; email: string };
      return decoded;
    } catch {
      throw new Error('Invalid token');
    }
  }
}

// Validation functions - pure business logic
export function validateRegisterData(data: any): { email: string; password: string; name?: string } {
  if (!data.email || !data.password) {
    throw new Error('Email and password are required');
  }

  if (typeof data.email !== 'string' || typeof data.password !== 'string') {
    throw new Error('Email and password must be strings');
  }

  if (data.name && typeof data.name !== 'string') {
    throw new Error('Name must be a string');
  }

  return {
    email: data.email,
    password: data.password,
    name: data.name
  };
}

export function validateLoginData(data: any): { email: string; password: string } {
  if (!data.email || !data.password) {
    throw new Error('Email and password are required');
  }

  if (typeof data.email !== 'string' || typeof data.password !== 'string') {
    throw new Error('Email and password must be strings');
  }

  return {
    email: data.email,
    password: data.password
  };
}
