import prisma from '../lib/prisma';

// Define enum locally until Prisma types are fully resolved
export enum VersionChangeType {
  PATCH = 'PATCH',
  MINOR = 'MINOR', 
  MAJOR = 'MAJOR'
}

export interface CreateVersionOptions {
  promptId: string;
  userId: string;
  changeType?: VersionChangeType;
  commitMessage?: string;
  parentVersionId?: string;
}

export interface VersionDiff {
  field: string;
  oldValue: any;
  newValue: any;
  changeType: 'added' | 'removed' | 'modified';
}

/**
 * Version Control Service
 * Handles prompt versioning, branching, and history management
 */
export class VersionService {
  
  /**
   * Create a new version of a prompt
   */
  static async createVersion(options: CreateVersionOptions) {
    const { promptId, userId, changeType = VersionChangeType.PATCH, commitMessage, parentVersionId } = options;
    
    // Get the current prompt data
    const prompt = await prisma.prompt.findUnique({
      where: { id: promptId }
    });
    
    if (!prompt) {
      throw new Error('Prompt not found');
    }
    
    // Calculate next version number
    const nextVersion = await this.calculateNextVersion(promptId, changeType);
    const [major, minor, patch] = nextVersion.split('.').map(Number);
    
    // Get current version to calculate changes
    const currentVersion = await (prisma as any).promptVersion.findFirst({
      where: { promptId },
      orderBy: { createdAt: 'desc' }
    });
    
    // Calculate changes summary if there's a parent version
    let changesSummary = null;
    if (currentVersion) {
      changesSummary = await this.calculateChangesSummary(prompt, currentVersion);
    }
    
    // Create the new version using 'any' to bypass TypeScript issues temporarily
    const newVersion = await (prisma as any).promptVersion.create({
      data: {
        versionNumber: nextVersion,
        majorVersion: major,
        minorVersion: minor,
        patchVersion: patch,
        name: prompt.name,
        description: prompt.description,
        content: prompt.content,
        variables: prompt.variables,
        metadata: prompt.metadata,
        commitMessage,
        changeType,
        changesSummary,
        promptId,
        createdBy: userId,
        parentVersionId: parentVersionId || currentVersion?.id
      }
    });
    
    // Update the prompt's current version (temporarily commenting out currentVersionId)
    await prisma.prompt.update({
      where: { id: promptId },
      data: {
        // version: nextVersion, // Keep as number for now
        // currentVersionId: newVersion.id
      }
    });
    
    return newVersion;
  }
  
  /**
   * Get version history for a prompt
   */
  static async getVersionHistory(promptId: string, userId: string) {
    // Verify user has access to this prompt
    const prompt = await prisma.prompt.findFirst({
      where: { id: promptId, userId }
    });
    
    if (!prompt) {
      throw new Error('Prompt not found or access denied');
    }
    
    return await (prisma as any).promptVersion.findMany({
      where: { promptId },
      include: {
        createdByUser: { select: { id: true, name: true, email: true } },
        parentVersion: { select: { id: true, versionNumber: true } },
        _count: { select: { childVersions: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
  
  /**
   * Get a specific version
   */
  static async getVersion(versionId: string, userId: string) {
    const version = await (prisma as any).promptVersion.findUnique({
      where: { id: versionId },
      include: {
        prompt: { select: { userId: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
        parentVersion: { select: { id: true, versionNumber: true } },
        childVersions: { select: { id: true, versionNumber: true, createdAt: true } }
      }
    });
    
    if (!version || version.prompt.userId !== userId) {
      throw new Error('Version not found or access denied');
    }
    
    return version;
  }
  
  /**
   * Revert prompt to a specific version
   */
  static async revertToVersion(promptId: string, versionId: string, userId: string) {
    // Get the target version
    const targetVersion = await this.getVersion(versionId, userId);
    
    // Verify the version belongs to the correct prompt
    if (targetVersion.promptId !== promptId) {
      throw new Error('Version does not belong to this prompt');
    }
    
    // Update the prompt with the version's content
    const updatedPrompt = await prisma.prompt.update({
      where: { id: promptId },
      data: {
        name: targetVersion.name,
        description: targetVersion.description,
        content: targetVersion.content,
        variables: targetVersion.variables,
        metadata: targetVersion.metadata,
        // version: targetVersion.versionNumber, // Skip for now
        // currentVersionId: targetVersion.id, // Skip for now
        updatedAt: new Date()
      }
    });
    
    return updatedPrompt;
  }
  
  /**
   * Compare two versions and return differences
   */
  static async compareVersions(version1Id: string, version2Id: string, userId: string): Promise<VersionDiff[]> {
    const [v1, v2] = await Promise.all([
      this.getVersion(version1Id, userId),
      this.getVersion(version2Id, userId)
    ]);
    
    const diffs: VersionDiff[] = [];
    
    // Compare basic fields
    const fields = ['name', 'description', 'content'];
    for (const field of fields) {
      const oldValue = (v1 as any)[field];
      const newValue = (v2 as any)[field];
      
      if (oldValue !== newValue) {
        diffs.push({
          field,
          oldValue,
          newValue,
          changeType: oldValue ? (newValue ? 'modified' : 'removed') : 'added'
        });
      }
    }
    
    // Compare variables (more complex comparison)
    const oldVariables = JSON.stringify(v1.variables);
    const newVariables = JSON.stringify(v2.variables);
    
    if (oldVariables !== newVariables) {
      diffs.push({
        field: 'variables',
        oldValue: v1.variables,
        newValue: v2.variables,
        changeType: 'modified'
      });
    }
    
    // Compare metadata
    const oldMetadata = JSON.stringify(v1.metadata);
    const newMetadata = JSON.stringify(v2.metadata);
    
    if (oldMetadata !== newMetadata) {
      diffs.push({
        field: 'metadata',
        oldValue: v1.metadata,
        newValue: v2.metadata,
        changeType: 'modified'
      });
    }
    
    return diffs;
  }
  
  /**
   * Calculate the next version number based on change type
   */
  private static async calculateNextVersion(promptId: string, changeType: VersionChangeType): Promise<string> {
    const latestVersion = await (prisma as any).promptVersion.findFirst({
      where: { promptId },
      orderBy: [
        { majorVersion: 'desc' },
        { minorVersion: 'desc' },
        { patchVersion: 'desc' }
      ]
    });
    
    let major = 1, minor = 0, patch = 0;
    
    if (latestVersion) {
      major = latestVersion.majorVersion;
      minor = latestVersion.minorVersion;
      patch = latestVersion.patchVersion;
      
      switch (changeType) {
        case VersionChangeType.MAJOR:
          major++;
          minor = 0;
          patch = 0;
          break;
        case VersionChangeType.MINOR:
          minor++;
          patch = 0;
          break;
        case VersionChangeType.PATCH:
          patch++;
          break;
      }
    }
    
    return `${major}.${minor}.${patch}`;
  }
  
  /**
   * Calculate changes summary between current prompt and its current version
   */
  private static async calculateChangesSummary(currentPrompt: any, previousVersion: any) {
    const changes: Record<string, any> = {};
    
    if (currentPrompt.name !== previousVersion.name) {
      changes.name = { from: previousVersion.name, to: currentPrompt.name };
    }
    
    if (currentPrompt.description !== previousVersion.description) {
      changes.description = { from: previousVersion.description, to: currentPrompt.description };
    }
    
    if (currentPrompt.content !== previousVersion.content) {
      changes.content = {
        hasChanges: true,
        oldLength: previousVersion.content?.length || 0,
        newLength: currentPrompt.content?.length || 0
      };
    }
    
    // Compare variables array
    const oldVars = JSON.stringify(previousVersion.variables);
    const newVars = JSON.stringify(currentPrompt.variables);
    
    if (oldVars !== newVars) {
      changes.variables = {
        hasChanges: true,
        oldCount: Array.isArray(previousVersion.variables) ? previousVersion.variables.length : 0,
        newCount: Array.isArray(currentPrompt.variables) ? currentPrompt.variables.length : 0
      };
    }
    
    return Object.keys(changes).length > 0 ? changes : null;
  }
  
  /**
   * Get version statistics for a prompt
   */
  static async getVersionStats(promptId: string, userId: string) {
    // Verify access
    const prompt = await prisma.prompt.findFirst({
      where: { id: promptId, userId }
    });
    
    if (!prompt) {
      throw new Error('Prompt not found or access denied');
    }
    
    const stats = await (prisma as any).promptVersion.aggregate({
      where: { promptId },
      _count: { id: true },
      _max: { createdAt: true },
      _min: { createdAt: true }
    });
    
    const versionsByType = await (prisma as any).promptVersion.groupBy({
      by: ['changeType'],
      where: { promptId },
      _count: { changeType: true }
    });
    
    return {
      totalVersions: stats._count.id,
      firstVersion: stats._min.createdAt,
      lastVersion: stats._max.createdAt,
      versionsByType: versionsByType.reduce((acc: Record<string, number>, item: any) => {
        acc[item.changeType] = item._count.changeType;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}