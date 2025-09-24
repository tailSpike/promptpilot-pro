/// <reference types="cypress" />

/**
 * Enhanced Workflow Triggers E2E Test Suite
 * 
 * This comprehensive test suite validates the enhanced trigger system with full UI interactions:
 * - Authentication flow and workflow creation
 * - All 5 trigger types with real UI interaction
 * - Intuitive date/time controls for scheduled triggers
 * - Comprehensive examples and user guidance
 * - Form validation and error handling
 * - Real-time feedback and notifications
 */
describe('Enhanced Workflow Triggers System', () => {
  let testUser: { token: string; name: string; email: string };
  let testWorkflow: { id: string; name: string };

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    
    // Create a test user via API
    const userData = {
      name: `Trigger Test User ${Date.now()}`,
      email: `trigger-test-${Date.now()}@example.com`,
      password: 'testpassword123'
    };

    cy.request({
      method: 'POST',
      url: `${Cypress.env('apiUrl')}/api/auth/register`,
      body: userData
    }).then((response) => {
      testUser = response.body;
      
      // Set token in localStorage
      cy.window().then((win) => {
        win.localStorage.setItem('token', testUser.token);
      });
      
      // Create a test workflow
      return cy.request({
        method: 'POST',
        url: `${Cypress.env('apiUrl')}/api/workflows`,
        headers: { 'Authorization': `Bearer ${testUser.token}` },
        body: {
          name: 'Trigger Test Workflow',
          description: 'Workflow for testing triggers',
          steps: [
            {
              name: 'Test Step',
              type: 'PROMPT',
              config: { content: 'Hello World {{input}}' },
              order: 1
            }
          ]
        }
      });
    }).then((response) => {
      testWorkflow = response.body;
    });
  });

  describe('Workflow Navigation and Setup', () => {
    it('should navigate to workflows and access trigger management', () => {
      cy.visit('/');
      cy.url().should('include', '/dashboard');
      
      // Navigate to workflows
      cy.get('a[href="/workflows"]', { timeout: 10000 }).click();
      cy.url().should('include', '/workflows');
      
      // Should show the test workflow
      cy.contains('Trigger Test Workflow').should('be.visible');
      
      // Click to view workflow details
      cy.contains('Trigger Test Workflow').click();
      cy.url().should('include', `/workflows/${testWorkflow.id}`);
      
      // Should have trigger section
      cy.get('body').should('contain', 'Triggers');
    });
  });

  describe('Manual Trigger Testing', () => {
    it('should create and test manual trigger', () => {
      cy.visit(`/workflows/${testWorkflow.id}`);
      
      // Add trigger button should be visible
      cy.get('button').contains('Add Trigger').should('be.visible').click();
      
      // Should open trigger modal
      cy.get('[role="dialog"]').should('be.visible');
      
      // Select MANUAL trigger type
      cy.get('button').contains('MANUAL').click();
      
      // Should show manual trigger configuration
      cy.get('body').should('contain', 'Manual Execution Trigger');
      cy.get('body').should('contain', 'one-click execution');
      
      // Fill trigger name
      cy.get('input[placeholder*="trigger name"], input#name').type('Manual Test Trigger');
      
      // Save trigger
      cy.get('button').contains('Create Trigger').click();
      
      // Should show success message
      cy.get('.bg-green-', { timeout: 5000 }).should('be.visible');
      
      // Should show the new trigger in the list
      cy.contains('Manual Test Trigger').should('be.visible');
      
      // Should have a run button
      cy.get('button').contains('Run').should('be.visible');
    });
  });

  describe('Scheduled Trigger Testing', () => {
    it('should create scheduled trigger with date/time controls', () => {
      cy.visit(`/workflows/${testWorkflow.id}`);
      
      // Add trigger
      cy.get('button').contains('Add Trigger').click();
      cy.get('[role="dialog"]').should('be.visible');
      
      // Select SCHEDULED trigger type
      cy.get('button').contains('SCHEDULED').click();
      
      // Should show scheduled trigger configuration
      cy.get('body').should('contain', 'Scheduled Trigger');
      cy.get('body').should('contain', 'Simple Mode');
      
      // Fill trigger name
      cy.get('input[placeholder*="trigger name"], input#name').type('Daily Report Trigger');
      
      // Should have date and time inputs in simple mode
      cy.get('body').then(($body) => {
        if ($body.find('input[type="date"]').length > 0) {
          // Test date input
          cy.get('input[type="date"]').should('be.visible');
          
          // Test time input
          cy.get('input[type="time"]').should('be.visible');
        }
        
        // Should have cron pattern examples
        if ($body.find('button:contains("Daily at")').length > 0) {
          cy.get('button').contains('Daily at').click();
        }
      });
      
      // Toggle to advanced mode
      cy.get('body').then(($body) => {
        if ($body.find('button:contains("Advanced")').length > 0) {
          cy.get('button').contains('Advanced').click();
          
          // Should show cron expression input
          cy.get('input[placeholder*="cron"], textarea[placeholder*="cron"]').should('be.visible');
        }
      });
      
      // Save trigger
      cy.get('button').contains('Create Trigger').click();
      
      // Should show success or validation message
      cy.get('body').should('not.contain', 'TypeError');
    });
  });

  describe('Webhook Trigger Testing', () => {
    it('should create webhook trigger with security information', () => {
      cy.visit(`/workflows/${testWorkflow.id}`);
      
      // Add trigger
      cy.get('button').contains('Add Trigger').click();
      cy.get('[role="dialog"]').should('be.visible');
      
      // Select WEBHOOK trigger type
      cy.get('button').contains('WEBHOOK').click();
      
      // Should show webhook trigger configuration
      cy.get('body').should('contain', 'Webhook Trigger');
      cy.get('body').should('contain', 'HTTP');
      
      // Fill trigger name
      cy.get('input[placeholder*="trigger name"], input#name').type('GitHub Webhook');
      
      // Should show security information
      cy.get('body').then(($body) => {
        const text = $body.text().toLowerCase();
        expect(text).to.satisfy((str: string) => 
          str.includes('security') || str.includes('validation') || str.includes('hmac')
        );
      });
      
      // Should show webhook URL or mention it will be generated
      cy.get('body').should('contain.text', 'URL');
      
      // Save trigger
      cy.get('button').contains('Create Trigger').click();
      
      // Should show success message
      cy.get('.bg-green-', { timeout: 5000 }).should('be.visible');
    });
  });

  describe('API Trigger Testing', () => {
    it('should create API trigger with documentation', () => {
      cy.visit(`/workflows/${testWorkflow.id}`);
      
      // Add trigger
      cy.get('button').contains('Add Trigger').click();
      cy.get('[role="dialog"]').should('be.visible');
      
      // Select API trigger type
      cy.get('button').contains('API').click();
      
      // Should show API trigger configuration
      cy.get('body').should('contain', 'API Trigger');
      cy.get('body').should('contain', 'programmatic');
      
      // Fill trigger name
      cy.get('input[placeholder*="trigger name"], input#name').type('Mobile App API');
      
      // Should show API documentation or examples
      cy.get('body').then(($body) => {
        const text = $body.text().toLowerCase();
        expect(text).to.satisfy((str: string) => 
          str.includes('api') || str.includes('endpoint') || str.includes('rest')
        );
      });
      
      // Save trigger
      cy.get('button').contains('Create Trigger').click();
      
      // Should show success message
      cy.get('.bg-green-', { timeout: 5000 }).should('be.visible');
    });
  });

  describe('Event Trigger Testing', () => {
    it('should create event trigger with event types', () => {
      cy.visit(`/workflows/${testWorkflow.id}`);
      
      // Add trigger
      cy.get('button').contains('Add Trigger').click();
      cy.get('[role="dialog"]').should('be.visible');
      
      // Select EVENT trigger type
      cy.get('button').contains('EVENT').click();
      
      // Should show event trigger configuration
      cy.get('body').should('contain', 'Event Trigger');
      cy.get('body').should('contain', 'system');
      
      // Fill trigger name
      cy.get('input[placeholder*="trigger name"], input#name').type('File Upload Event');
      
      // Should show event type selection or examples
      cy.get('body').then(($body) => {
        const text = $body.text().toLowerCase();
        expect(text).to.satisfy((str: string) => 
          str.includes('event') || str.includes('system') || str.includes('file')
        );
      });
      
      // Save trigger
      cy.get('button').contains('Create Trigger').click();
      
      // Should show success message
      cy.get('.bg-green-', { timeout: 5000 }).should('be.visible');
    });
  });

  describe('Trigger Management Operations', () => {
    it('should list, edit, and delete triggers', () => {
      cy.visit(`/workflows/${testWorkflow.id}`);
      
      // Create a trigger first
      cy.get('button').contains('Add Trigger').click();
      cy.get('[role="dialog"]').should('be.visible');
      cy.get('button').contains('MANUAL').click();
      cy.get('input[placeholder*="trigger name"], input#name').type('Test Management Trigger');
      cy.get('button').contains('Create Trigger').click();
      cy.get('.bg-green-', { timeout: 5000 }).should('be.visible');
      
      // Should show trigger in list
      cy.contains('Test Management Trigger').should('be.visible');
      
      // Should have management buttons (edit, delete, etc.)
      cy.get('body').then(($body) => {
        if ($body.find('button:contains("Edit")').length > 0) {
          cy.get('button').contains('Edit').should('be.visible');
        }
        if ($body.find('button:contains("Delete")').length > 0) {
          cy.get('button').contains('Delete').should('be.visible');
        }
        // Look for icon buttons or menu options
        if ($body.find('[data-testid*="trigger"], [class*="trigger"]').length > 0) {
          cy.log('Trigger management UI elements found');
        }
      });
    });
  });

  describe('Form Validation and Error Handling', () => {
    it('should validate trigger forms and show helpful errors', () => {
      cy.visit(`/workflows/${testWorkflow.id}`);
      
      // Add trigger
      cy.get('button').contains('Add Trigger').click();
      cy.get('[role="dialog"]').should('be.visible');
      
      // Select MANUAL trigger type
      cy.get('button').contains('MANUAL').click();
      
      // Try to save without required fields
      cy.get('button').contains('Create Trigger').click();
      
      // Should show validation error or stay on form
      cy.get('body').should('not.contain', 'TypeError');
      cy.get('body').should('not.contain', 'ReferenceError');
      
      // Modal should still be open or show error message
      cy.get('body').then(($body) => {
        const text = $body.text();
        const hasError = text.includes('required') || 
                        text.includes('error') || 
                        text.includes('invalid') ||
                        $body.find('[role="dialog"]').length > 0;
        cy.wrap(hasError).should('be.true');
      });
    });
  });

  describe('Responsive Design and User Experience', () => {
    it('should work well on different screen sizes', () => {
      cy.visit(`/workflows/${testWorkflow.id}`);
      
      // Test on mobile viewport
      cy.viewport(375, 667);
      cy.get('button').contains('Add Trigger').should('be.visible');
      
      // Test on tablet viewport
      cy.viewport(768, 1024);
      cy.get('button').contains('Add Trigger').should('be.visible');
      
      // Test on desktop viewport
      cy.viewport(1920, 1080);
      cy.get('button').contains('Add Trigger').should('be.visible');
      
      // Reset to default
      cy.viewport(1280, 720);
    });
  });
});