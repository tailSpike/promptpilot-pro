/// <reference types="cypress" />

describe('Workflow trigger API regression', () => {
  const backendUrl = () => Cypress.env('apiUrl') as string;
  const password = 'testpassword123!';
  const suffix = Date.now();
  const email = `trigger-api-${suffix}@example.com`;
  const name = 'Trigger API Regression User';
  const workflowName = `Trigger API Workflow ${suffix}`;

  let token: string;
  let workflowId: string;

  before(() => {
    cy.request({
      method: 'POST',
      url: `${backendUrl()}/api/auth/register`,
      body: { name, email, password }
    })
      .then((registerResponse) => {
        token = registerResponse.body.token;

        return cy.request({
          method: 'POST',
          url: `${backendUrl()}/api/workflows`,
          headers: { Authorization: `Bearer ${token}` },
          body: {
            name: workflowName,
            description: 'Regression workflow for trigger API coverage',
            isActive: true
          }
        });
      })
      .then((workflowResponse) => {
        workflowId = workflowResponse.body.id;
        expect(workflowId, 'workflow id should exist').to.be.a('string');
      });
  });

  it('creates, retrieves, executes, updates, and deletes a trigger', () => {
    let triggerId: string;

    cy.request({
      method: 'POST',
      url: `${backendUrl()}/api/workflows/${workflowId}/triggers`,
      headers: { Authorization: `Bearer ${token}` },
      body: {
        name: 'API Regression Trigger',
        type: 'MANUAL',
        isActive: true,
        config: {}
      }
    })
      .then((createResponse) => {
        expect(createResponse.status).to.eq(201);
        triggerId = createResponse.body.id;
        expect(triggerId, 'trigger id should exist').to.be.a('string');

        return cy.request({
          method: 'GET',
          url: `${backendUrl()}/api/triggers/${triggerId}`,
          headers: { Authorization: `Bearer ${token}` }
        });
      })
      .then((getResponse) => {
        expect(getResponse.status).to.eq(200);
        expect(getResponse.body.name).to.eq('API Regression Trigger');

        return cy.request({
          method: 'POST',
          url: `${backendUrl()}/api/triggers/${triggerId}/execute`,
          headers: { Authorization: `Bearer ${token}` }
        });
      })
      .then((executeResponse) => {
        expect(executeResponse.status).to.eq(200);

        return cy.request({
          method: 'PUT',
          url: `${backendUrl()}/api/triggers/${triggerId}`,
          headers: { Authorization: `Bearer ${token}` },
          body: {
            name: 'API Regression Trigger Updated',
            isActive: false
          }
        });
      })
      .then((updateResponse) => {
        expect(updateResponse.status).to.eq(200);
  expect(updateResponse.body.isActive).to.eq(false);

        return cy.request({
          method: 'DELETE',
          url: `${backendUrl()}/api/triggers/${triggerId}`,
          headers: { Authorization: `Bearer ${token}` }
        });
      })
      .then((deleteResponse) => {
        expect([200, 204]).to.include(deleteResponse.status);

        return cy.request({
          method: 'GET',
          url: `${backendUrl()}/api/triggers/${triggerId}`,
          headers: { Authorization: `Bearer ${token}` },
          failOnStatusCode: false
        });
      })
      .then((postDeleteResponse) => {
        expect(postDeleteResponse.status).to.eq(404);
      });
  });
});