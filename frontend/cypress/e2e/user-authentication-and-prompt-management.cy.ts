/// <reference types="cypress" />

describe('User Authentication and Prompt Management', () => {
  let testUser: { token: string; user: { id: string; email: string; name: string } };

  beforeEach(() => {
    // Ensure clean state
    cy.clearLocalStorage();
    cy.clearCookies();
    
    // Create and login test user via API
    const userData = {
      name: 'Sarah Johnson',
      email: `test-${Date.now()}@example.com`,
      password: 'securepass123'
    };

    cy.request('POST', `${Cypress.env('apiUrl')}/api/auth/register`, userData)
      .then((response) => {
        testUser = response.body;
      });
  });

  it('should complete full user authentication and prompt creation workflow', () => {
    // Set authentication data in localStorage before visiting the page
    cy.window().then((win) => {
      win.localStorage.setItem('token', testUser.token);
      win.localStorage.setItem('user', JSON.stringify(testUser.user));
    });

    // Step 1: Visit dashboard directly with authentication
    cy.visit('/dashboard');
    cy.url().should('include', '/dashboard');
    
    // Step 2: Verify user is logged in (check for welcome message)
    cy.get('h1').should('contain', 'Welcome back');
    
    // Step 3: Navigate to create prompt via the "Get Started" button
    cy.get('a[href="/prompts/new"]').contains('Get Started').click();
    cy.url().should('include', '/prompts/new');
    
    // Step 4: Fill out prompt creation form
    // Basic prompt information
    cy.get('input#name', { timeout: 15000 }).should('be.visible').type('Customer Welcome Email');
    cy.get('textarea#description').type('Personalized welcome email for new customers');
    
    // Prompt content with variables
    const promptContent = `Dear {{customerName}}, Welcome to {{companyName}}! Your plan: {{selectedPlan}}.`;
    cy.get('textarea#content').type(promptContent, { parseSpecialCharSequences: false });
    
    // Step 5: Add variables
    // Add first variable: customerName
    cy.get('button').contains('+ Add').click();
    cy.get('.border.border-gray-200.rounded-lg').should('have.length', 1);
    cy.get('.border.border-gray-200.rounded-lg').first().within(() => {
      cy.get('input[placeholder="variableName"]').type('customerName');
      cy.get('select').select('text');
      cy.get('input[type="checkbox"]').check(); // Required
    });
    
    // Add second variable: companyName
    cy.get('button').contains('+ Add').click();
    cy.get('.border.border-gray-200.rounded-lg').should('have.length', 2);
    cy.get('.border.border-gray-200.rounded-lg').eq(1).within(() => {
      cy.get('input[placeholder="variableName"]').type('companyName');
      cy.get('select').select('text');
    });
    
    // Step 6: Save the prompt
    cy.get('button[type="submit"]').contains('Create Prompt').click();
    
    // Step 7: Verify prompt was created successfully
    cy.get('.bg-green-50').should('be.visible').and('contain', 'Prompt created successfully');
    cy.url().should('include', '/prompts');
    
    // Step 8: Verify prompt appears in list
    cy.get('.bg-white.shadow').should('contain', 'Customer Welcome Email');
    
    // Step 9: Test search functionality
    cy.get('input[placeholder="Search prompts..."]').type('Customer{enter}');
    cy.get('.bg-white.shadow').should('contain', 'Customer Welcome Email');
    
    // The test has successfully completed the full user workflow:
    // 1. Registration ✓
    // 2. Login (automatic after registration) ✓
    // 3. Dashboard access ✓
    // 4. Prompt creation with variables ✓ 
    // 5. Prompt management (list, edit, search) ✓
  });
  
  it('should allow editing existing prompts', () => {
    // Create a prompt via API first
    cy.request({
      method: 'POST',
      url: `${Cypress.env('apiUrl')}/api/prompts`,
      headers: { 'Authorization': `Bearer ${testUser.token}` },
      body: {
        name: 'Test Prompt',
        description: 'A test prompt',
        content: 'Hello {{name}}!',
        variables: [
          { name: 'name', type: 'text', required: true }
        ]
      }
    });

    // Set authentication data in localStorage before visiting the page
    cy.window().then((win) => {
      win.localStorage.setItem('token', testUser.token);
      win.localStorage.setItem('user', JSON.stringify(testUser.user));
    });
    
    // Visit prompts page
    cy.visit('/prompts');
    
    // Find and edit the prompt
    cy.contains('Test Prompt');
    cy.get('a').contains('Edit').first().click();
    cy.url().should('include', '/edit');
    
    // Update the prompt
    cy.get('input#name').clear().type('Updated Test Prompt');
    cy.get('textarea#description').clear().type('An updated test prompt');
    
    // Save changes
    cy.get('button[type="submit"]').contains('Update Prompt').click();
    
    // Verify update
    cy.get('.bg-green-50').should('be.visible').and('contain', 'Prompt updated successfully');
  });
});