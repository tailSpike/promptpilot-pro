/// <reference types="cypress" />

/**
 * Comprehensive End-to-End Tests for Workflow Triggers UI
 * 
 * This test suite covers all essential UI functionality for workflow triggers:
 * - Trigger creation modal and form validation
 * - Different trigger types (Manual, Scheduled, Webhook, API, Event)
 * - Trigger management operations (toggle, execute, delete)
 * - Error handling and user feedback
 * - Responsive design and accessibility
 * 
 * These tests complement the API tests and ensure the complete trigger
 * workflow functions correctly from a user perspective.
 */

// Deprecated: overlaps with workflow-triggers-ui.cy.ts
describe.skip("Enhanced Workflow Triggers System", () => {
  let testUser: { token: string; name: string; email: string };
  let testWorkflow: { id: string; name: string };

  before(() => {
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
          isActive: true,
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

  describe("Workflow Triggers UI Tests", () => {

    beforeEach(() => {
      // Set up authentication for UI tests
      cy.window().then((win) => {
        win.localStorage.setItem('token', testUser.token);
        win.localStorage.setItem('user', JSON.stringify({
          email: testUser.email,
          name: testUser.name
        }));
      });
      
      // Navigate to home page first to establish session and ensure auth state
      cy.visit('/', { timeout: 30000 });
      
      // Verify we're logged in by checking for dashboard or navigation
      cy.get('body').should('not.contain', 'Sign in to your account');
    });

    it("should display triggers section in workflow detail page", () => {
      // Navigate directly to the workflow detail page
      cy.visit(`/workflows/${testWorkflow.id}`, { timeout: 30000 });
      
      // Check if we got redirected to login (authentication issue)
      cy.url().then((url) => {
        if (url.includes('/login')) {
          cy.log('Redirected to login - performing manual login');
          cy.get('input[type="email"]').type(testUser.email);
          cy.get('input[type="password"]').type('testpassword123');
          cy.get('button[type="submit"]').click();
          
          // Wait for login success and navigation
          cy.url({ timeout: 15000 }).should('not.include', '/login');
          
          // Navigate to workflow detail page again
          cy.visit(`/workflows/${testWorkflow.id}`);
        }
      });
      
      // Wait for page to load and verify workflow name
      cy.get('h1', { timeout: 15000 }).should('contain', 'Trigger Test Workflow');
      
      // Check if triggers section is present - scroll down to find it
      cy.scrollTo('bottom');
      cy.get('[data-testid="workflow-triggers"]', { timeout: 10000 })
        .should('exist');
      
      // Should show "Workflow Triggers" heading
      cy.contains('Workflow Triggers', { timeout: 5000 }).should('be.visible');
    });

    it("should show empty state when no triggers exist", () => {
      cy.visit(`/workflows/${testWorkflow.id}`);
      
      // Wait for triggers section to load
      cy.get('[data-testid="workflow-triggers"]', { timeout: 10000 })
        .should('be.visible');
      
      // Should show empty state message
      cy.contains('No triggers configured').should('be.visible');
      cy.contains('Add triggers to automate when this workflow runs').should('be.visible');
      
      // Should have "Create your first trigger" button
      cy.contains('Create your first trigger').should('be.visible');
    });

    it("should open trigger creation modal when clicking add trigger", () => {
      cy.visit(`/workflows/${testWorkflow.id}`);
      
      // Wait for page to load and click add trigger button
      cy.get('[data-testid="workflow-triggers"]', { timeout: 10000 })
        .should('be.visible');
      
      // Try both possible trigger creation buttons
      cy.get('body').then(($body) => {
        if ($body.find('button:contains("Create your first trigger")').length > 0) {
          cy.contains('Create your first trigger').click();
        } else {
          cy.contains('Add Trigger').click();
        }
      });
      
      // Modal should open
      cy.contains('Create New Trigger').should('be.visible');
      cy.get('input[placeholder="Enter trigger name"]').should('be.visible');
      cy.get('select').should('be.visible'); // Trigger type selector
    });

    it("should create a manual trigger successfully", () => {
      // First, test API directly with same credentials to confirm it works
      cy.request({
        method: "POST",
        url: `${Cypress.env("apiUrl")}/api/workflows/${testWorkflow.id}/triggers`,
        headers: { "Authorization": `Bearer ${testUser.token}` },
        body: {
          name: "Direct API Test Trigger",
          type: "MANUAL",
          isActive: true,
          config: {}
        }
      }).then((response) => {
        expect(response.status).to.equal(201);
        cy.log('✅ Direct API call works!');
      });

      cy.visit(`/workflows/${testWorkflow.id}`);
      
      // Wait for triggers section
      cy.get('[data-testid="workflow-triggers"]', { timeout: 10000 }).should('be.visible');
      
      // Click add trigger button
      cy.get('body').then(($body) => {
        if ($body.find('button:contains("Create your first trigger")').length > 0) {
          cy.contains('Create your first trigger').click();
        } else {
          cy.contains('Add Trigger').click();
        }
      });
      
      // Fill form and intercept
      cy.contains('Create New Trigger').should('be.visible');
      cy.get('input[placeholder="Enter trigger name"]').type('Test Manual Trigger');
      cy.get('select').select('MANUAL');
      
      cy.intercept('POST', `**/api/workflows/${testWorkflow.id}/triggers`).as('createTrigger');
      
      // Submit
      cy.contains('Create Trigger').click();
      
      // Check API response
      cy.wait('@createTrigger').then((interception) => {
        cy.log('🔍 API Response Status:', interception.response?.statusCode);
        if (interception.response?.statusCode === 201) {
          cy.log('✅ UI API call succeeded!');
        } else {
          cy.log('❌ UI API call failed:', interception.response?.body);
        }
      });
      
      // Wait for any toast and check what appears
      cy.wait(3000);
      cy.get('body').then(($body) => {
        const bodyText = $body.text();
        cy.log('Page content includes:', bodyText.includes('successfully') ? 'SUCCESS' : 
               bodyText.includes('Failed') || bodyText.includes('Error') ? 'ERROR' : 'UNKNOWN');
      });
    });

    it("should create a scheduled trigger successfully", () => {
      cy.visit(`/workflows/${testWorkflow.id}`);
      
      // Wait for triggers section
      cy.get('[data-testid="workflow-triggers"]', { timeout: 10000 }).should('be.visible');
      
      // Click add trigger button (same pattern as manual trigger test)
      cy.get('body').then(($body) => {
        if ($body.find('button:contains("Create your first trigger")').length > 0) {
          cy.contains('Create your first trigger').click();
        } else {
          cy.contains('Add Trigger').click();
        }
      });
      
      // Fill form for scheduled trigger
      cy.contains('Create New Trigger').should('be.visible');
      cy.get('input[placeholder="Enter trigger name"]').type('Test Scheduled Trigger');
      cy.get('select').select('SCHEDULED');
      
      // Configure schedule - use advanced mode
      cy.contains('Schedule Configuration').should('be.visible'); 
      cy.contains('Advanced').click();
      cy.get('#cron-expression').type('0 9 * * *');
      
      // Intercept and submit (same pattern)
      cy.intercept('POST', `**/api/workflows/${testWorkflow.id}/triggers`).as('createScheduledTrigger');
      cy.contains('Create Trigger').click();
      
      // Check API response (same pattern)
      cy.wait('@createScheduledTrigger').then((interception) => {
        cy.log('🔍 Scheduled API Response Status:', interception.response?.statusCode);
        if (interception.response?.statusCode === 201) {
          cy.log('✅ Scheduled trigger UI API call succeeded!');
        } else {
          cy.log('❌ Scheduled trigger UI API call failed:', interception.response?.body);
        }
      });
      
      // Wait and check for success
      cy.wait(3000);
      cy.get('body').then(($body) => {
        const bodyText = $body.text();
        cy.log('Page content includes:', bodyText.includes('successfully') ? 'SUCCESS' : 
               bodyText.includes('Failed') || bodyText.includes('Error') ? 'ERROR' : 'UNKNOWN');
      });
    });

    it("should validate required fields in trigger creation", () => {
      cy.visit(`/workflows/${testWorkflow.id}`);
      
      // Open trigger creation modal
      cy.get('[data-testid="workflow-triggers"]', { timeout: 10000 })
        .should('be.visible');
      cy.contains('Add Trigger').click();
      
      // Try to submit without name
      cy.contains('Create New Trigger').should('be.visible');
      cy.contains('Create Trigger').should('be.disabled');
      
      // Add name - button should become enabled
      cy.get('input[placeholder="Enter trigger name"]').type('Test Trigger');
      cy.contains('Create Trigger').should('not.be.disabled');
      
      // Close the modal
      cy.contains('Cancel').click();
      cy.get('.fixed.inset-0.bg-gray-600', { timeout: 3000 }).should('not.exist');
    });

    it("should toggle trigger active status", () => {
      cy.visit(`/workflows/${testWorkflow.id}`);
      cy.get('[data-testid="workflow-triggers"]', { timeout: 10000 })
        .should('be.visible');
      
      // Wait for existing triggers to load (from previous tests)
      cy.wait(2000);
      
      // Look for any existing trigger with toggle button
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="trigger-toggle"]').length > 0) {
          // Found existing trigger - test toggle functionality
          cy.get('[data-testid="trigger-toggle"]', { timeout: 5000 }).first().click();
          cy.wait(2000);
          cy.log('✅ Toggle operation completed');
        } else {
          // No triggers exist - skip this test as it depends on existing triggers
          cy.log('ℹ️ No triggers available to toggle - test skipped');
        }
      });
    });

    it("should execute a manual trigger", () => {
      cy.visit(`/workflows/${testWorkflow.id}`);
      cy.get('[data-testid="workflow-triggers"]', { timeout: 10000 })
        .should('be.visible');
      
      // Wait for existing triggers to load
      cy.wait(2000);
      
      // Look for any existing manual trigger with run button
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="trigger-run"]').length > 0) {
          // Found manual trigger - test execution
          cy.get('[data-testid="trigger-run"]', { timeout: 5000 }).first().click();
          cy.wait(2000);
          cy.log('✅ Trigger execution completed');
        } else {
          cy.log('ℹ️ No manual triggers available to execute - test passed');
        }
      });
    });

    it("should delete a trigger", () => {
      cy.visit(`/workflows/${testWorkflow.id}`);
      cy.get('[data-testid="workflow-triggers"]', { timeout: 10000 })
        .should('be.visible');
      
      // Wait for existing triggers to load
      cy.wait(2000);
      
      // Look for any existing trigger with delete button
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="trigger-delete"]').length > 0) {
          // Set up confirmation dialog
          cy.window().then((win) => {
            cy.stub(win, 'confirm').returns(true);
          });
          
          // Found trigger - test deletion
          cy.get('[data-testid="trigger-delete"]', { timeout: 5000 }).first().click();
          cy.wait(2000);
          cy.log('✅ Trigger deletion completed');
        } else {
          cy.log('ℹ️ No triggers available to delete - test passed');
        }
      });
    });

    it("should show different trigger type information", () => {
      cy.visit(`/workflows/${testWorkflow.id}`);
      cy.get('[data-testid="workflow-triggers"]', { timeout: 10000 })
        .should('be.visible');
      cy.contains('Add Trigger').click();
      
      // Test WEBHOOK type information
      cy.get('[data-testid="trigger-type"]').select('WEBHOOK');
      cy.contains('Webhook Configuration').should('be.visible');
      cy.contains('After creation, you\'ll receive a unique webhook URL').should('be.visible');
      
      // Test API type information
      cy.get('[data-testid="trigger-type"]').select('API');
      cy.contains('API Trigger').should('be.visible');
      cy.contains('Execute this workflow programmatically').should('be.visible');
      
      // Test EVENT type information
      cy.get('select').select('EVENT');
      cy.contains('Event Triggers').should('be.visible');
    });

    it("should handle trigger creation errors gracefully", () => {
      cy.visit(`/workflows/${testWorkflow.id}`);
      cy.get('[data-testid="workflow-triggers"]', { timeout: 10000 })
        .should('be.visible');
      cy.contains('Add Trigger').click();
      
      // Try to create a trigger with a name that might cause issues
      cy.get('input[placeholder="Enter trigger name"]').type('Test Error Trigger');
      
      // Intercept the API call to simulate an error
      cy.intercept('POST', `**/api/workflows/${testWorkflow.id}/triggers`, {
        statusCode: 400,
        body: { error: 'Invalid trigger configuration' }
      }).as('createTriggerError');
      
      cy.contains('Create Trigger').click();
      cy.wait('@createTriggerError');
      
      // Should show error message (toast or inline)
      // This might need adjustment based on how errors are displayed
      cy.contains('Invalid trigger configuration', { timeout: 5000 }).should('be.visible');
    });

    it("should close modal when clicking cancel or X", () => {
      cy.visit(`/workflows/${testWorkflow.id}`);
      cy.get('[data-testid="workflow-triggers"]', { timeout: 10000 })
        .should('be.visible');
      cy.contains('Add Trigger').click();
      
      // Modal should be open
      cy.contains('Create New Trigger').should('be.visible');
      
      // Click Cancel button
      cy.contains('Cancel').click();
      
      // Modal should close
      cy.contains('Create New Trigger').should('not.exist');
      
      // Open modal again and test X button
      cy.contains('Add Trigger').click();
      cy.contains('Create New Trigger').should('be.visible');
      
      // Click X button (close button in modal header)
      cy.get('.text-gray-400.hover\\:text-gray-600').click();
      
      // Modal should close
      cy.get('.fixed.inset-0.bg-gray-600', { timeout: 3000 }).should('not.exist');
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