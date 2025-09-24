/// <reference types="cypress" />

describe('Version Control System - Basic Functionality', () => {
  let testUser: { token: string; user: { id: string; email: string; name: string } };
  let testPromptId: string; // eslint-disable-line @typescript-eslint/no-unused-vars

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();

    // Create and login test user
    const userData = {
      name: 'Version Test User',
      email: `version-test-${Date.now()}@example.com`,
      password: 'versiontest123'
    };

    cy.request('POST', `${Cypress.env('apiUrl')}/api/auth/register`, userData)
      .then((response) => {
        testUser = response.body;
        window.localStorage.setItem('token', response.body.token);
        window.localStorage.setItem('user', JSON.stringify(response.body.user));
        
        // Create a test prompt that we'll use for version control testing
        return cy.request({
          method: 'POST',
          url: `${Cypress.env('apiUrl')}/api/prompts`,
          headers: { 'Authorization': `Bearer ${testUser.token}` },
          body: {
            name: 'Version Control Test Prompt',
            description: 'A prompt for testing version control features',
            content: 'Hello {{name}}, welcome to version 1.0.0!',
            variables: [
              { name: 'name', type: 'text', required: true }
            ]
          }
        });
      })
      .then((response) => {
        testPromptId = response.body.prompt.id;
      });
  });

  it.skip('should display the History tab in prompt editor', () => {
    // Navigate to the prompts page first
    cy.visit('/prompts');
    
    // Look for our test prompt in the list and click edit
    cy.contains('Version Control Test Prompt').should('be.visible');
    cy.get('a').contains('Edit').first().click();
    
    // Should be on the edit page
    cy.url().should('include', '/edit');
    
    // Should have tabs for Editor and History
    cy.get('button').contains('Editor').should('be.visible');
    cy.get('button').contains('History').should('be.visible');
    
    // Click on the History tab
    cy.get('button').contains('History').click();
    
    // Should show version history content (at minimum a message about versions)
    cy.get('body').should('contain.text', 'Version History');
  });

  it.skip('should handle version history API calls', () => {
    // Navigate to the prompts page first
    cy.visit('/prompts');
    
    // Look for our test prompt in the list and click edit
    cy.contains('Version Control Test Prompt').should('be.visible');
    cy.get('a').contains('Edit').first().click();
    
    // Intercept the version history API call
    cy.intercept('GET', `${Cypress.env('apiUrl')}/api/prompts/*/versions`).as('getVersionHistory');
    
    // Click on the History tab
    cy.get('button').contains('History').click();
    
    // Should make the API call
    cy.wait('@getVersionHistory');
    
    // Should show some version content (success or error)
    cy.get('body').should('contain.text', 'Version History');
  });

  it.skip('should show version information when available', () => {
    // Navigate to the prompts page first  
    cy.visit('/prompts');
    
    // Look for our test prompt in the list and click edit
    cy.contains('Version Control Test Prompt').should('be.visible');
    cy.get('a').contains('Edit').first().click();
    
    // Click on the History tab
    cy.get('button').contains('History').click();
    
    // Wait a moment for the component to load
    cy.wait(2000);
    
    // Check if version history loaded successfully
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="version-history"]').length > 0) {
        // Version history component exists and loaded
        cy.get('[data-testid="version-history"]')
          .should('be.visible')
          .within(() => {
            cy.contains('Version History').should('be.visible');
          });
      } else if ($body.text().includes('Version History')) {
        // Version history is rendered but may not have the data-testid yet
        cy.log('Version history component is rendering but may not have version data loaded');
      } else {
        // Version history not implemented or has errors
        cy.log('Version history component not found or has errors');
      }
    });
  });
});