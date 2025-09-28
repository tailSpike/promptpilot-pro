const { createPrismaClient } = require('./dist/lib/prisma');
const { VersionService } = require('./dist/services/versionService');

const prisma = createPrismaClient();

async function testVersionControl() {
    try {
        console.log('🧪 Testing Version Control System...\n');
        
        // First, let's check if we can create a user and prompt for testing
        console.log('1. Creating test user...');
        const testUser = await prisma.user.upsert({
            where: { email: 'test@example.com' },
            update: {},
            create: {
                email: 'test@example.com',
                name: 'Test User',
                password: 'hashedpassword'
            }
        });
        console.log(`✅ Test user created: ${testUser.id}\n`);

        // Create a test prompt
        console.log('2. Creating test prompt...');
        const testPrompt = await prisma.prompt.create({
            data: {
                name: 'Test Prompt for Versioning',
                content: 'This is a test prompt with {{variable}}',
                variables: [{ name: 'variable', type: 'text', required: true }],
                userId: testUser.id
            }
        });
        console.log(`✅ Test prompt created: ${testPrompt.id}\n`);

        // Test version creation
        console.log('3. Testing version creation...');
        const version1 = await VersionService.createVersion({
            promptId: testPrompt.id,
            userId: testUser.id,
            changeType: 'MAJOR',
            commitMessage: 'Initial version'
        });
        console.log(`✅ Version 1 created: ${version1.versionNumber}\n`);

        // Test getting version history
        console.log('4. Testing version history retrieval...');
        const versions = await VersionService.getVersionHistory(testPrompt.id, testUser.id);
        console.log(`✅ Found ${versions.length} versions in history\n`);

        // Test version statistics
        console.log('5. Testing version statistics...');
        const stats = await VersionService.getVersionStats(testPrompt.id, testUser.id);
        console.log(`✅ Version stats:`, stats);
        
        console.log('\n🎉 All tests passed! Version control system is working correctly.');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testVersionControl();