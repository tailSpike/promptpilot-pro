import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthService } from '../../services/auth.service';

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

describe('AuthService', () => {
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  } as any;
  const service = new AuthService(prismaMock);
  const hashMock = bcrypt.hash as jest.Mock;
  const compareMock = bcrypt.compare as jest.Mock;
  const signMock = jwt.sign as jest.Mock;
  const verifyMock = jwt.verify as jest.Mock;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.JWT_SECRET = 'unit-secret';
  });

  describe('registerUser', () => {
    it('creates a user and returns token', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      hashMock.mockResolvedValue('hashed');
      prismaMock.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'new@example.com',
        name: 'New User',
        role: 'USER',
        password: 'hashed',
      });
      signMock.mockReturnValue('signed-token');

      const result = await service.registerUser({
        email: 'new@example.com',
        password: 'Secret123',
        name: 'New User',
      });

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: 'new@example.com' } });
      expect(hashMock).toHaveBeenCalledWith('Secret123', 12);
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          email: 'new@example.com',
          password: 'hashed',
          name: 'New User',
        },
      });
      expect(signMock).toHaveBeenCalledWith({ userId: 'user-1', email: 'new@example.com' }, 'unit-secret', { expiresIn: '7d' });
      expect(result).toEqual({
        user: {
          id: 'user-1',
          email: 'new@example.com',
          name: 'New User',
          role: 'USER',
        },
        token: 'signed-token',
      });
    });

    it('throws when user already exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.registerUser({ email: 'exists@example.com', password: 'Secret123' })
      ).rejects.toThrow('User with this email already exists');

      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });
  });

  describe('loginUser', () => {
    it('authenticates and returns token', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed',
        name: null,
        role: 'USER',
      });
      compareMock.mockResolvedValue(true);
      signMock.mockReturnValue('jwt-token');

      const result = await service.loginUser({ email: 'test@example.com', password: 'Secret123' });

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      expect(compareMock).toHaveBeenCalledWith('Secret123', 'hashed');
      expect(result.token).toBe('jwt-token');
    });

    it('throws when user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.loginUser({ email: 'missing@example.com', password: 'Secret123' })
      ).rejects.toThrow('Invalid credentials');
    });

    it('throws when password invalid', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed',
      });
      compareMock.mockResolvedValue(false);

      await expect(
        service.loginUser({ email: 'test@example.com', password: 'Wrong' })
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('getUserById', () => {
    it('returns user data when found', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Tester',
        role: 'ADMIN',
      });

      const user = await service.getUserById('user-1');

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      expect(user).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Tester',
        role: 'ADMIN',
      });
    });

    it('throws when user missing', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserById('missing')).rejects.toThrow('User not found');
    });
  });

  describe('token helpers', () => {
    it('verifies valid token', () => {
      verifyMock.mockReturnValue({ userId: 'user-1', email: 'test@example.com' });

      const payload = service.verifyToken('token');

      expect(verifyMock).toHaveBeenCalledWith('token', 'unit-secret');
      expect(payload).toEqual({ userId: 'user-1', email: 'test@example.com' });
    });

    it('throws for invalid token', () => {
      verifyMock.mockImplementation(() => { throw new Error('boom'); });

      expect(() => service.verifyToken('bad-token')).toThrow('Invalid token');
    });
  });
});
