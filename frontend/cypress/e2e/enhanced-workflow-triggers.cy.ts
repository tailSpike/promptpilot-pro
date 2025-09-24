/// <reference types="cypress" />

describe("Enhanced Workflow Triggers System", () => {
  let testUser: { token: string; name: string; email: string };
  let testWorkflow: { id: string; name: string };

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    
    const userData = {
      name: `Trigger Test User ${Date.now()}`,
      email: `trigger-test-${Date.now()}@example.com`,
      password: "testpassword123"
    };

    cy.request({
      method: "POST",
      url: `${Cypress.env("apiUrl")}/api/auth/register`,
      body: userData
    }).then((response) => {
      testUser = response.body;
      
      return cy.request({
        method: "POST",
        url: `${Cypress.env("apiUrl")}/api/workflows`,
        headers: { "Authorization": `Bearer ${testUser.token}` },
        body: {
          name: "Trigger Test Workflow",
          description: "Workflow for testing triggers",
          steps: [{
            name: "Test Step",
            type: "PROMPT", 
            config: { content: "Hello World {{input}}" },
            order: 1
          }]
        }
      });
    }).then((response) => {
      testWorkflow = response.body;
    });
  });

  describe("API Tests", () => {
    it("should create triggers via API", () => {
      const triggerData = {
        name: "Manual Test Trigger",
        type: "MANUAL",
        isActive: true,
        config: {}
      };

      cy.request({
        method: "POST",
        url: `${Cypress.env("apiUrl")}/api/workflows/${testWorkflow.id}/triggers`,
        headers: { "Authorization": `Bearer ${testUser.token}` },
        body: triggerData
      }).then((response) => {
        expect(response.status).to.equal(201);
        expect(response.body).to.have.property("id");
        expect(response.body.name).to.equal(triggerData.name);
      });
    });

    it("should list triggers via API", () => {
      cy.request({
        method: "GET",
        url: `${Cypress.env("apiUrl")}/api/workflows/${testWorkflow.id}/triggers`,
        headers: { "Authorization": `Bearer ${testUser.token}` }
      }).then((response) => {
        expect(response.status).to.equal(200);
        expect(response.body).to.be.an("array");
      });
    });
  });
});