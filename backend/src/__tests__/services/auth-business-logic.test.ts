/**
 * Unit tests for Auth Service business logic
 * These tests focus on pure business logic without database interactions
 */

import { validateRegisterData, validateLoginData } from '../../services/auth.service';

describe('Auth Service Business Logic', () => {
  describe('validateRegisterData', () => {
    it('should validate valid registration data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      };

      const result = validateRegisterData(validData);
      
      expect(result).toEqual(validData);
    });

    it('should validate registration data without name', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123'
      };

      const result = validateRegisterData(validData);
      
      expect(result.email).toBe(validData.email);
      expect(result.password).toBe(validData.password);
      expect(result.name).toBeUndefined();
    });

    it('should throw error for missing email', () => {
      const invalidData = {
        password: 'password123'
      };

      expect(() => validateRegisterData(invalidData))
        .toThrow('Email and password are required');
    });

    it('should throw error for missing password', () => {
      const invalidData = {
        email: 'test@example.com'
      };

      expect(() => validateRegisterData(invalidData))
        .toThrow('Email and password are required');
    });

    it('should throw error for non-string email', () => {
      const invalidData = {
        email: 123,
        password: 'password123'
      };

      expect(() => validateRegisterData(invalidData))
        .toThrow('Email and password must be strings');
    });

    it('should throw error for non-string password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 123
      };

      expect(() => validateRegisterData(invalidData))
        .toThrow('Email and password must be strings');
    });

    it('should throw error for non-string name', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'password123',
        name: 123
      };

      expect(() => validateRegisterData(invalidData))
        .toThrow('Name must be a string');
    });
  });

  describe('validateLoginData', () => {
    it('should validate valid login data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123'
      };

      const result = validateLoginData(validData);
      
      expect(result).toEqual(validData);
    });

    it('should throw error for missing email', () => {
      const invalidData = {
        password: 'password123'
      };

      expect(() => validateLoginData(invalidData))
        .toThrow('Email and password are required');
    });

    it('should throw error for missing password', () => {
      const invalidData = {
        email: 'test@example.com'
      };

      expect(() => validateLoginData(invalidData))
        .toThrow('Email and password are required');
    });

    it('should throw error for non-string email', () => {
      const invalidData = {
        email: 123,
        password: 'password123'
      };

      expect(() => validateLoginData(invalidData))
        .toThrow('Email and password must be strings');
    });

    it('should throw error for non-string password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 123
      };

      expect(() => validateLoginData(invalidData))
        .toThrow('Email and password must be strings');
    });
  });
});
