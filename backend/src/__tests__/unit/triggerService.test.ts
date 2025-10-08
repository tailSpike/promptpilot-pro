import * as cron from 'node-cron';
import crypto from 'crypto';
import prisma from '../../lib/prisma';
import { triggerService } from '../../services/triggerService';

describe('TriggerService utility behaviour', () => {
  beforeEach(() => {
    jest.spyOn(prisma.workflow, 'findUnique').mockResolvedValue({ userId: 'user-123' } as any);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    (triggerService as any).scheduledTasks.clear();
  });

  it('validates scheduled trigger config and rejects invalid cron', async () => {
    const validateSpy = jest.spyOn(cron, 'validate').mockReturnValue(true);

    await (triggerService as any).validateTriggerConfig('SCHEDULED', { cron: '* * * * *' });
    expect(validateSpy).toHaveBeenCalledWith('* * * * *');

    validateSpy.mockReturnValue(false);
    await expect(
      (triggerService as any).validateTriggerConfig('SCHEDULED', { cron: 'invalid' }),
    ).rejects.toThrow('Invalid cron expression');
  });

  it('generates secrets for webhook and API triggers when absent', async () => {
    const randomBytesSpy = jest
      .spyOn(crypto, 'randomBytes')
      .mockImplementation(() => Buffer.from('0123456789abcdef0123456789abcdef', 'hex'));

    const webhookConfig: Record<string, any> = {};
    await (triggerService as any).validateTriggerConfig('WEBHOOK', webhookConfig);
  expect(webhookConfig.secret).toBe('0123456789abcdef0123456789abcdef');

    const apiConfig: Record<string, any> = {};
    await (triggerService as any).validateTriggerConfig('API', apiConfig);
  expect(apiConfig.apiKey).toBe('0123456789abcdef0123456789abcdef');

    await expect(
      (triggerService as any).validateTriggerConfig('UNSUPPORTED', {}),
    ).rejects.toThrow('Unsupported trigger type');

    randomBytesSpy.mockRestore();
  });

  it('sets up and reuses scheduled tasks with stop semantics', async () => {
    const firstTask = { start: jest.fn(), stop: jest.fn() } as unknown as cron.ScheduledTask;
    const secondTask = { start: jest.fn(), stop: jest.fn() } as unknown as cron.ScheduledTask;

    const scheduleSpy = jest
      .spyOn(cron, 'schedule')
      .mockImplementationOnce(() => firstTask)
      .mockImplementationOnce(() => secondTask);

    await (triggerService as any).setupScheduledTask({
      id: 'trigger-1',
      name: 'Daily digest',
      config: JSON.stringify({ cron: '* * * * *' }),
      workflowId: 'workflow-1',
    });

    expect(firstTask.start).toHaveBeenCalled();
    expect((triggerService as any).scheduledTasks.get('trigger-1')).toBe(firstTask);

    await (triggerService as any).setupScheduledTask({
      id: 'trigger-1',
      name: 'Daily digest',
      config: JSON.stringify({ cron: '*/5 * * * *' }),
      workflowId: 'workflow-1',
    });

    expect(firstTask.stop).toHaveBeenCalledTimes(1);
    expect(secondTask.start).toHaveBeenCalledTimes(1);
    expect((triggerService as any).scheduledTasks.get('trigger-1')).toBe(secondTask);

    expect(scheduleSpy).toHaveBeenCalledTimes(2);
  });

  it('stops all scheduled triggers and clears cache', async () => {
    const taskA = { stop: jest.fn() } as unknown as cron.ScheduledTask;
    const taskB = { stop: jest.fn() } as unknown as cron.ScheduledTask;
    (triggerService as any).scheduledTasks.set('A', taskA);
    (triggerService as any).scheduledTasks.set('B', taskB);

    await triggerService.stopAllScheduledTriggers();

    expect(taskA.stop).toHaveBeenCalledTimes(1);
    expect(taskB.stop).toHaveBeenCalledTimes(1);
    expect((triggerService as any).scheduledTasks.size).toBe(0);
  });

  it('creates scheduled triggers and normalizes config payloads', async () => {
    const workflowSpy = jest.spyOn(prisma.workflow, 'findFirst').mockResolvedValue({ id: 'wf-1', userId: 'user-1' } as any);
    const triggerCreateSpy = jest.spyOn(prisma.workflowTrigger, 'create').mockResolvedValue({
      id: 'trg-1',
      name: 'nightly run',
      type: 'SCHEDULED',
      isActive: true,
      config: JSON.stringify({ cron: '* * * * *', timezone: 'UTC' }),
      workflowId: 'wf-1',
      workflow: { id: 'wf-1', userId: 'user-1' },
    } as any);
    jest.spyOn(cron, 'validate').mockReturnValue(true);
    const setupSpy = jest.spyOn(triggerService as any, 'setupScheduledTask').mockResolvedValue(undefined);

    const result = await triggerService.createTrigger('wf-1', 'user-1', {
      name: 'nightly run',
      type: 'SCHEDULED',
      config: { cron: '* * * * *', timezone: 'UTC' },
    });

    expect(workflowSpy).toHaveBeenCalledWith({ where: { id: 'wf-1', userId: 'user-1' } });
    expect(triggerCreateSpy).toHaveBeenCalledWith({
      data: {
        name: 'nightly run',
        type: 'SCHEDULED',
        isActive: true,
        config: JSON.stringify({ cron: '* * * * *', timezone: 'UTC' }),
        workflowId: 'wf-1',
      },
      include: { workflow: true },
    });
    expect(setupSpy).toHaveBeenCalled();
    expect(result.config).toEqual({ cron: '* * * * *', timezone: 'UTC' });
  });

  it('rejects trigger creation when workflow is missing', async () => {
    jest.spyOn(prisma.workflow, 'findFirst').mockResolvedValue(null as any);

    await expect(
      triggerService.createTrigger('wf-1', 'user-1', { name: 'bad', type: 'MANUAL' }),
    ).rejects.toThrow('Workflow not found or access denied');
  });

  it('updates triggers, merging config and restarting schedule when needed', async () => {
    const stopSpy = jest.spyOn(triggerService as any, 'stopScheduledTask');
    jest.spyOn(cron, 'validate').mockReturnValue(true);
    jest.spyOn(triggerService, 'getTriggerById').mockResolvedValue({
      id: 'trg-1',
      type: 'SCHEDULED',
      config: JSON.stringify({ cron: '* * * * *', timezone: 'UTC' }),
      workflow: { id: 'wf-1', userId: 'user-1' },
    } as any);
    const updateSpy = jest.spyOn(prisma.workflowTrigger, 'update').mockResolvedValue({
      id: 'trg-1',
      type: 'SCHEDULED',
      isActive: true,
      config: JSON.stringify({ cron: '*/5 * * * *', timezone: 'UTC' }),
      workflow: { id: 'wf-1', userId: 'user-1' },
    } as any);
    const setupSpy = jest.spyOn(triggerService as any, 'setupScheduledTask').mockResolvedValue(undefined);

    const updated = await triggerService.updateTrigger('trg-1', 'user-1', {
      config: { cron: '*/5 * * * *' },
    });

    expect(stopSpy).toHaveBeenCalledWith('trg-1');
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 'trg-1' },
      data: {
        config: JSON.stringify({ cron: '*/5 * * * *', timezone: 'UTC' }),
      },
      include: { workflow: true },
    });
    expect(setupSpy).toHaveBeenCalled();
    expect(updated.config).toEqual({ cron: '*/5 * * * *', timezone: 'UTC' });
  });

  it('replaces config when changing trigger type and auto-generates secrets', async () => {
    const randomBytesSpy = jest
      .spyOn(crypto, 'randomBytes')
      .mockImplementation(() => Buffer.from('0123456789abcdef0123456789abcdef', 'hex'));
    jest.spyOn(triggerService, 'getTriggerById').mockResolvedValue({
      id: 'trg-2',
      type: 'MANUAL',
      config: JSON.stringify({ secret: 'old-secret' }),
      workflow: { id: 'wf-1', userId: 'user-1' },
    } as any);
    const updateSpy = jest.spyOn(prisma.workflowTrigger, 'update').mockResolvedValue({
      id: 'trg-2',
      type: 'WEBHOOK',
      isActive: true,
      config: JSON.stringify({ secret: '0123456789abcdef0123456789abcdef', allowedOrigins: ['https://app.example'] }),
      workflow: { id: 'wf-1', userId: 'user-1' },
    } as any);

    const result = await triggerService.updateTrigger('trg-2', 'user-1', {
      type: 'WEBHOOK',
      config: { allowedOrigins: ['https://app.example'] },
    });

    const [updateArgs] = updateSpy.mock.calls[0];
    const configString = updateArgs.data.config as string;
    expect(JSON.parse(configString)).toEqual({
      secret: '0123456789abcdef0123456789abcdef',
      allowedOrigins: ['https://app.example'],
    });
    expect(result.config).toEqual({
      secret: '0123456789abcdef0123456789abcdef',
      allowedOrigins: ['https://app.example'],
    });
    randomBytesSpy.mockRestore();
  });

  it('deletes triggers and stops scheduled tasks when necessary', async () => {
    jest.spyOn(triggerService, 'getTriggerById').mockResolvedValue({
      id: 'trg-3',
      type: 'SCHEDULED',
      config: JSON.stringify({ cron: '* * * * *' }),
      workflow: { userId: 'user-1' },
    } as any);
    const stopSpy = jest.spyOn(triggerService as any, 'stopScheduledTask');
    const deleteSpy = jest.spyOn(prisma.workflowTrigger, 'delete').mockResolvedValue({} as any);

    const result = await triggerService.deleteTrigger('trg-3', 'user-1');

    expect(stopSpy).toHaveBeenCalledWith('trg-3');
    expect(deleteSpy).toHaveBeenCalledWith({ where: { id: 'trg-3' } });
    expect(result).toBe(true);
  });

  it('initializes scheduled triggers and logs failures without crashing', async () => {
    jest.spyOn(prisma.workflowTrigger, 'findMany').mockResolvedValue([
      {
        id: 'trg-valid',
        name: 'valid',
        type: 'SCHEDULED',
        isActive: true,
        config: JSON.stringify({ cron: '* * * * *' }),
        workflow: {},
      },
      {
        id: 'trg-invalid-json',
        name: 'broken',
        type: 'SCHEDULED',
        isActive: true,
        config: '{bad json}',
        workflow: {},
      },
      {
        id: 'trg-error',
        name: 'error',
        type: 'SCHEDULED',
        isActive: true,
        config: JSON.stringify({ cron: '* * * * *' }),
        workflow: {},
      },
    ] as any);
    jest.spyOn(cron, 'validate').mockReturnValue(true);
    const setupSpy = jest
      .spyOn(triggerService as any, 'setupScheduledTask')
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => {
        throw new Error('boom');
      });

    await triggerService.initializeScheduledTriggers();

    expect(setupSpy).toHaveBeenCalledTimes(2);
  });
});
