/// <reference types="cypress" />

export interface WorkflowFixture {
  token: string;
  user: { id: string; email: string; name: string };
  password: string;
  email: string;
  workflowId: string;
  workflowName: string;
}

const backendUrl = () => Cypress.env('apiUrl') as string;

export const createWorkflowFixture = (
  prefix: string,
  options?: {
    workflow?: Partial<{
      description: string;
      isActive: boolean;
      steps: Array<Record<string, unknown>>;
    }>;
    password?: string;
  }
): Cypress.Chainable<WorkflowFixture> => {
  const timestamp = Date.now();
  const password = options?.password ?? 'testpassword123!';
  const email = `${prefix}-${timestamp}@example.com`;
  const name = `${prefix} User`;
  const workflowName = options?.workflow?.description
    ? `${prefix} Workflow`
    : `${prefix} Workflow ${timestamp}`;

  return cy
    .request({
      method: 'POST',
      url: `${backendUrl()}/api/auth/register`,
      body: {
        name,
        email,
        password
      }
    })
    .then((registerResponse) => {
      const token = registerResponse.body.token as string;
      const user = registerResponse.body.user as WorkflowFixture['user'];

      const workflowBody = {
        name: workflowName,
        description: options?.workflow?.description ?? 'Workflow created for regression coverage',
        isActive: options?.workflow?.isActive ?? true,
        steps:
          options?.workflow?.steps ?? (
            [
              {
                name: 'Prompt Step',
                type: 'PROMPT',
                order: 0,
                config: {
                  content: 'Hello {{user}}',
                  model: 'gpt-4o-mini'
                }
              }
            ] as Array<Record<string, unknown>>
          )
      };

      return cy
        .request({
          method: 'POST',
          url: `${backendUrl()}/api/workflows`,
          headers: { Authorization: `Bearer ${token}` },
          body: workflowBody
        })
        .then((workflowResponse) => {
          return cy.wrap({
            token,
            user,
            password,
            email,
            workflowId: workflowResponse.body.id as string,
            workflowName
          });
        });
    });
};

export const visitWithAuth = (path: string, fixture: WorkflowFixture) => {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem('token', fixture.token);
      win.localStorage.setItem('user', JSON.stringify(fixture.user));
    }
  });
};
