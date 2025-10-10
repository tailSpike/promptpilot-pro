import 'dotenv/config';
import prisma from '../src/lib/prisma';
import { IntegrationCredentialService } from '../src/services/integrationCredential.service';

async function ensureUser(email: string, name: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  // Hash password using bcryptjs (reuse service behavior)
  const bcrypt = await import('bcryptjs');
  const hashed = await bcrypt.hash(password, 10);
  return prisma.user.create({ data: { email, name, password: hashed } });
}

async function ensureOpenAICredential(ownerId: string, actorId: string) {
  const secret = process.env.OPENAI_API_KEY;
  if (!secret) {
    console.warn('OPENAI_API_KEY not set; skipping creation of OpenAI integration credential.');
    return null;
  }
  // Check if any active credential exists for this owner/provider
  const existing = await prisma.integrationCredential.findFirst({
    where: { ownerId, provider: 'openai' },
    orderBy: [{ updatedAt: 'desc' }],
  });
  if (existing) return existing;
  return IntegrationCredentialService.create({ ownerId, actorId, provider: 'openai', label: 'Default OpenAI Key', secret });
}

async function ensurePrompts(userId: string) {
  // Simple two prompts for chaining
  const prompt1 = await prisma.prompt.create({
    data: {
      name: 'Step 1: Summarize',
      content: 'Summarize the following text in 2 sentences.\n\nText:\n{{inputText}}',
      variables: { items: [{ name: 'inputText', dataType: 'string', isRequired: true }] },
      userId,
    },
  });

  const prompt2 = await prisma.prompt.create({
    data: {
      name: 'Step 2: Rewrite as bullets',
      content: 'Rewrite the previous summary into 5 concise bullet points.\n\nPrevious summary:\n{{previousGeneratedText}}',
      variables: { items: [{ name: 'previousGeneratedText', dataType: 'string', isRequired: true }] },
      userId,
    },
  });

  return { prompt1, prompt2 };
}

async function ensureWorkflow(userId: string, prompt1Id: string, prompt2Id: string) {
  const name = 'Demo: Summarize then Bulletize';
  const existing = await prisma.workflow.findFirst({ where: { userId, name } });
  if (existing) return existing;

  const wf = await prisma.workflow.create({ data: { userId, name, description: 'Two-step demo workflow with chaining', isActive: true } });

  // Variables: inputText required
  await prisma.workflowVariable.create({
    data: {
      workflowId: wf.id,
      name: 'inputText',
      type: 'input',
      dataType: 'string',
      description: 'Text to summarize',
      isRequired: true,
    },
  });

  // Step 1: PROMPT using prompt1, exports summary as summary
  await prisma.workflowStep.create({
    data: {
      workflowId: wf.id,
      name: 'Summarize',
      type: 'PROMPT',
      order: 0,
      promptId: prompt1Id,
      config: {
        modelSettings: { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.3 },
        variables: { inputText: '{{inputText}}' },
      },
      outputs: { summary: 'generatedText' },
    },
  });

  // Step 2: PROMPT using prompt2, relies on built-in previousGeneratedText
  await prisma.workflowStep.create({
    data: {
      workflowId: wf.id,
      name: 'Bulletize',
      type: 'PROMPT',
      order: 1,
      promptId: prompt2Id,
      config: {
        modelSettings: { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.2 },
      },
    },
  });

  return wf;
}

async function main() {
  console.log('Seeding demo data...');
  const email = process.env.DEMO_USER_EMAIL || 'demo@example.com';
  const password = process.env.DEMO_USER_PASSWORD || 'demo123!';
  const name = process.env.DEMO_USER_NAME || 'Demo User';

  const user = await ensureUser(email, name, password);
  console.log(`User ready: ${user.email} (${user.id})`);

  await ensureOpenAICredential(user.id, user.id);

  const { prompt1, prompt2 } = await ensurePrompts(user.id);
  console.log(`Prompts created: ${prompt1.id}, ${prompt2.id}`);

  const wf = await ensureWorkflow(user.id, prompt1.id, prompt2.id);
  console.log(`Workflow ready: ${wf.name} (${wf.id})`);

  console.log('Seed complete. You can log in with:');
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${password}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
