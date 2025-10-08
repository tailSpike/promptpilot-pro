import 'dotenv/config';
import prisma from '../src/lib/prisma';
import { workflowService } from '../src/services/workflowService';

async function main() {
  const workflow = await prisma.workflow.findFirst({
    select: { id: true, userId: true, name: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (!workflow) {
    console.error('No workflows found in the database.');
    return;
  }

  console.log(`Previewing workflow ${workflow.name} (${workflow.id}) for user ${workflow.userId}`);

  const preview = await workflowService.previewWorkflow(workflow.id, workflow.userId, {
    input: {},
    useSampleData: true,
  });

  if (!preview) {
    console.error('Preview service returned null.');
    return;
  }

  console.log('Status:', preview.status);
  console.log('Warnings:', preview.warnings);
  console.log('Final output:', JSON.stringify(preview.finalOutput, null, 2));
  console.log('Final output keys:', preview.finalOutput ? Object.keys(preview.finalOutput) : null);
  console.log('Step results:');
  for (const step of preview.stepResults) {
    console.log(`  Step ${step.order} (${step.name}) status -> error? ${Boolean(step.error)} warnings ${step.warnings.length}`);
    console.log('    raw output:', JSON.stringify(step.output, null, 2));
    if (step.error) {
      console.log('    error message:', step.error.message);
      if (step.error.stack) {
        console.log('    stack snippet:', step.error.stack.split('\n').slice(0, 3).join('\n'));
      }
    }
    if (step.warnings.length > 0) {
      console.log('    warnings detail:', step.warnings.join(' | '));
    }
    if (step.output && typeof step.output === 'object' && 'providerResults' in step.output) {
      const providerResults = (step.output as any).providerResults as Array<Record<string, any>>;
      console.log('    providerResults length:', providerResults?.length ?? 0);
      if (Array.isArray(providerResults)) {
        console.table(providerResults.map((entry) => ({
          provider: entry.provider,
          model: entry.model,
          success: entry.success,
          simulated: entry.metadata?.simulated,
          warnings: Array.isArray(entry.warnings) ? entry.warnings.join(' | ') : entry.warnings,
          error: entry.error,
        })));
      }
    }
  }
}

main()
  .catch((error) => {
    console.error('Failed to preview workflow', error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
