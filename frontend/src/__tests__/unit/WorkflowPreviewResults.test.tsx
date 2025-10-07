import { render, screen } from '@testing-library/react';
import WorkflowPreviewResults, { type WorkflowPreviewResult } from '../../components/WorkflowPreviewResults';

describe('WorkflowPreviewResults', () => {
  it('shows COMPLETED badge when preview status is FAILED but simulated output exists', () => {
    const finalOutput: Record<string, unknown> = {
      content: 'Hi',
      generatedText: '[Simulated OpenAI preview] Hi',
      model: 'gpt-4o-mini',
      tokens: 0,
      primaryProvider: 'openai',
      modelOutputs: {
        openai: {
          'gpt-4o-mini': {
            label: 'OpenAI',
            text: '[Simulated OpenAI preview] Hi',
            success: true,
            tokens: 0,
            latencyMs: 0,
            metadata: {
              simulated: true,
            },
            warnings: [],
          },
        },
      },
      providerResults: [
        {
          provider: 'openai',
          model: 'gpt-4o-mini',
          label: 'OpenAI',
          success: true,
          outputText: '[Simulated OpenAI preview] Hi',
          tokensUsed: 0,
          latencyMs: 0,
          warnings: [],
          retries: 0,
          metadata: {
            simulated: true,
          },
        },
      ],
      resolvedVariables: {},
      warnings: [],
    };

    const stepOutput: Record<string, unknown> = {
      providerResults: [
        {
          provider: 'openai',
          model: 'gpt-4o-mini',
          label: 'OpenAI',
          success: true,
          outputText: '[Simulated OpenAI preview] Hi',
          tokensUsed: 0,
          latencyMs: 0,
          warnings: [],
          retries: 0,
          metadata: {
            simulated: true,
          },
        },
      ],
    };

    const preview: WorkflowPreviewResult = {
      workflowId: 'wf-1',
      status: 'FAILED',
      usedSampleData: true,
      input: {},
      finalOutput,
      totalDurationMs: 10,
      stepResults: [
        {
          stepId: 'step-1',
          name: 'Prompt',
          type: 'PROMPT',
          order: 0,
          startedAt: new Date().toISOString(),
          durationMs: 5,
          inputSnapshot: {},
          output: stepOutput,
          warnings: [],
        },
      ],
      stats: {
        stepsExecuted: 1,
        tokensUsed: 0,
      },
      warnings: [],
    };

    render(<WorkflowPreviewResults preview={preview} />);

    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    expect(screen.getByText('All providers returned errors, so a simulated preview output is shown for guidance only.')).toBeInTheDocument();
  });

  it('shows COMPLETED badge when simulated warning is present', () => {
    const preview: WorkflowPreviewResult = {
      workflowId: 'wf-2',
      status: 'FAILED',
      usedSampleData: false,
      input: {},
      finalOutput: null,
      totalDurationMs: 5,
      stepResults: [
        {
          stepId: 'step-1',
          name: 'Prompt',
          type: 'PROMPT',
          order: 0,
          startedAt: new Date().toISOString(),
          durationMs: 2,
          inputSnapshot: {},
          output: null,
          warnings: ['Simulated preview output because provider authentication failed.'],
        },
      ],
      stats: {
        stepsExecuted: 1,
        tokensUsed: 0,
      },
      warnings: ['Simulated preview output because provider authentication failed.'],
    };

    render(<WorkflowPreviewResults preview={preview} />);

    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
  });
});
