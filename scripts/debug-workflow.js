const fetch = global.fetch;

async function main() {
  const base = 'http://127.0.0.1:3001';
  const now = Date.now();

  const register = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Multi Model Debug ${now}`,
      email: `debug-${now}@example.com`,
      password: 'pass12345',
    }),
  });
  const regBody = await register.json();
  console.log('register status', register.status, regBody);

  const token = regBody.token;
  const workflowRes = await fetch(`${base}/api/workflows`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: `Debug Workflow ${now}`,
      isActive: true,
    }),
  });
  const workflow = await workflowRes.json();
  console.log('workflow status', workflowRes.status, workflow);

  const stepRes = await fetch(`${base}/api/workflows/${workflow.id}/steps`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: 'Prompt Step',
      type: 'PROMPT',
      order: 1,
      config: {
        description: 'Base',
        promptContent: 'Hi',
        modelSettings: {
          provider: 'openai',
          model: 'gpt-4o-mini',
        },
      },
    }),
  });
  const step = await stepRes.json();
  console.log('create step status', stepRes.status, step);

  const models = [
    {
      id: 'model-a',
      provider: 'openai',
      model: 'gpt-4o-mini',
      label: 'OpenAI',
      disabled: false,
      parameters: { temperature: 0.2, parallelToolCalls: true },
      retry: { maxAttempts: 2 },
    },
    {
      id: 'model-b',
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307',
      label: 'Claude',
      disabled: false,
      parameters: { temperature: 0.3 },
      retry: { maxAttempts: 2 },
    },
  ];

  const updatePayload = {
    name: 'Prompt Step',
    type: 'PROMPT',
    order: 1,
    config: {
      description: 'Base',
      promptContent: 'Hi',
      models,
      modelRouting: {
        mode: 'parallel',
        concurrency: 2,
        preferredOrder: models.map((m) => m.id),
        onError: 'continue',
      },
    },
  };

  const updateRes = await fetch(`${base}/api/workflows/${workflow.id}/steps/${step.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updatePayload),
  });
  console.log('update status', updateRes.status);
  const updateBody = await updateRes.json().catch(async () => ({ raw: await updateRes.text() }));
  console.dir(updateBody, { depth: null });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
