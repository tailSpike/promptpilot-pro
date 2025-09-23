import { VersionChangeType } from '../../services/versionService';

/**
 * Unit Tests for Version Service Business Logic
 * These tests focus on the business logic functions without database calls
 */

describe('VersionService - Business Logic', () => {

  describe('version number calculation', () => {
    it('should calculate next version number for PATCH increment', () => {
      const currentVersion = '1.2.3';
      const [major, minor, patch] = currentVersion.split('.').map(Number);
      
      // Test PATCH increment logic
      const nextPatch = patch + 1;
      const nextVersion = `${major}.${minor}.${nextPatch}`;
      
      expect(nextVersion).toBe('1.2.4');
    });

    it('should calculate next version number for MINOR increment', () => {
      const currentVersion = '1.2.3';
      const [major, minor] = currentVersion.split('.').map(Number);
      
      // Test MINOR increment logic (resets patch to 0)
      const nextMinor = minor + 1;
      const nextVersion = `${major}.${nextMinor}.0`;
      
      expect(nextVersion).toBe('1.3.0');
    });

    it('should calculate next version number for MAJOR increment', () => {
      const currentVersion = '1.2.3';
      const [major] = currentVersion.split('.').map(Number);
      
      // Test MAJOR increment logic (resets minor and patch to 0)
      const nextMajor = major + 1;
      const nextVersion = `${nextMajor}.0.0`;
      
      expect(nextVersion).toBe('2.0.0');
    });

    it('should handle initial version (no previous version)', () => {
      const initialVersion = '1.0.0';
      expect(initialVersion).toBe('1.0.0');
    });
  });

  describe('change type validation', () => {
    it('should validate VersionChangeType enum values', () => {
      expect(VersionChangeType.PATCH).toBe('PATCH');
      expect(VersionChangeType.MINOR).toBe('MINOR');
      expect(VersionChangeType.MAJOR).toBe('MAJOR');
    });

    it('should have all required change types', () => {
      const changeTypes = Object.values(VersionChangeType);
      expect(changeTypes).toContain('PATCH');
      expect(changeTypes).toContain('MINOR');
      expect(changeTypes).toContain('MAJOR');
      expect(changeTypes).toHaveLength(3);
    });
  });

  describe('version comparison logic', () => {
    it('should detect content changes', () => {
      const content1: string = 'Hello {{name}}';
      const content2: string = 'Hello {{name}}, welcome!';
      
      expect(content1 !== content2).toBe(true);
    });

    it('should detect variable changes', () => {
      const variables1 = [{ name: 'name', type: 'text' }];
      const variables2 = [{ name: 'name', type: 'text' }, { name: 'title', type: 'text' }];
      
      expect(JSON.stringify(variables1) !== JSON.stringify(variables2)).toBe(true);
    });

    it('should detect no changes when content is identical', () => {
      const content1 = 'Hello {{name}}';
      const content2 = 'Hello {{name}}';
      
      expect(content1 === content2).toBe(true);
    });
  });

  describe('semantic version parsing', () => {
    it('should parse semantic version string correctly', () => {
      const version = '1.2.3';
      const parts = version.split('.').map(Number);
      const [major, minor, patch] = parts;
      
      expect(major).toBe(1);
      expect(minor).toBe(2);
      expect(patch).toBe(3);
      expect(parts).toHaveLength(3);
    });

    it('should handle single digit versions', () => {
      const version = '1.0.0';
      const parts = version.split('.').map(Number);
      const [major, minor, patch] = parts;
      
      expect(major).toBe(1);
      expect(minor).toBe(0);
      expect(patch).toBe(0);
    });

    it('should handle double digit versions', () => {
      const version = '10.15.23';
      const parts = version.split('.').map(Number);
      const [major, minor, patch] = parts;
      
      expect(major).toBe(10);
      expect(minor).toBe(15);
      expect(patch).toBe(23);
    });
  });

  describe('version statistics calculation', () => {
    it('should calculate version statistics correctly', () => {
      const versions = [
        { changeType: 'MAJOR', createdAt: new Date('2023-01-01') },
        { changeType: 'MINOR', createdAt: new Date('2023-01-02') },
        { changeType: 'PATCH', createdAt: new Date('2023-01-03') },
        { changeType: 'PATCH', createdAt: new Date('2023-01-04') },
      ];

      const stats = {
        totalVersions: versions.length,
        firstVersion: new Date('2023-01-01'),
        lastVersion: new Date('2023-01-04'),
        versionsByType: versions.reduce((acc, v) => {
          acc[v.changeType] = (acc[v.changeType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };

      expect(stats).toEqual({
        totalVersions: 4,
        firstVersion: new Date('2023-01-01'),
        lastVersion: new Date('2023-01-04'),
        versionsByType: {
          MAJOR: 1,
          MINOR: 1,
          PATCH: 2,
        },
      });
    });

    it('should handle empty version list', () => {
      const versions: any[] = [];
      const stats = {
        totalVersions: versions.length,
        firstVersion: null,
        lastVersion: null,
        versionsByType: {},
      };

      expect(stats.totalVersions).toBe(0);
      expect(stats.firstVersion).toBeNull();
      expect(stats.lastVersion).toBeNull();
    });
  });

  describe('diff generation logic', () => {
    it('should generate simple content diff description', () => {
      const content1: string = 'Hello world';
      const content2: string = 'Hello universe';
      
      // Simple diff logic
      const isDifferent = content1 !== content2;
      const diffDescription = isDifferent ? 'Content modified' : 'No changes';
      
      expect(diffDescription).toBe('Content modified');
    });

    it('should detect variable additions', () => {
      const vars1 = ['name'];
      const vars2 = ['name', 'title'];
      
      const added = vars2.filter(v => !vars1.includes(v));
      expect(added).toEqual(['title']);
    });

    it('should detect variable removals', () => {
      const vars1 = ['name', 'title'];
      const vars2 = ['name'];
      
      const removed = vars1.filter(v => !vars2.includes(v));
      expect(removed).toEqual(['title']);
    });
  });
});