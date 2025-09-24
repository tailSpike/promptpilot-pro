const { PrismaClient } = require('@prisma/client');
const { VersionService } = require('./dist/services/versionService');

const prisma = new PrismaClient();

async function migrateExistingVersions() {
  try {
    console.log('🔄 Migrating existing versions to include change summaries...');
    
    // Get all versions 
    const allVersions = await prisma.promptVersion.findMany({
      include: {
        parentVersion: true,
        prompt: true
      },
      orderBy: { createdAt: 'asc' }
    });
    
    console.log(`Found ${allVersions.length} total versions`);
    
    let updatedCount = 0;
    for (const version of allVersions) {
      // Skip if already has changesSummary
      if (version.changesSummary && Object.keys(version.changesSummary).length > 0) {
        continue;
      }
      if (version.parentVersion) {
        console.log(`Processing version ${version.versionNumber} for prompt ${version.prompt.name}`);
        
        // Reconstruct prompt data from version for comparison
        const currentPromptData = {
          name: version.name,
          description: version.description,
          content: version.content,
          variables: version.variables,
          folderId: version.folderId
        };
        
        console.log(`  Current version data:`, JSON.stringify(currentPromptData, null, 2));
        console.log(`  Parent version data:`, JSON.stringify(version.parentVersion, null, 2));
        
        // Calculate changes between this version and parent
        const changes = await VersionService.calculateChangesSummary(currentPromptData, version.parentVersion);
        console.log(`  Calculated changes:`, JSON.stringify(changes, null, 2));
        
        // Update the version with calculated changes
        const updated = await prisma.promptVersion.update({
          where: { id: version.id },
          data: { changesSummary: changes }
        });
        
        console.log(`✅ Updated version ${version.versionNumber} with changes:`, JSON.stringify(updated.changesSummary, null, 2));
        updatedCount++;
      }
    }
    
    console.log(`🎉 Migration completed successfully! Updated ${updatedCount} versions.`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateExistingVersions();