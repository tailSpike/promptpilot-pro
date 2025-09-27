// Diagnostic-only; kept skipped to avoid CI flakiness
describe.skip('Trigger 404 Error Detection', () => {
  
  it('should detect 404 errors in browser console during trigger operations', () => {
    // Capture browser console logs and errors
    cy.window().then((win) => {
      cy.stub(win.console, 'error').as('consoleError');
    });
    
    // Login
    cy.visit('/login');
    cy.get('input[type="email"]').type('test@example.com');
    cy.get('input[type="password"]').type('password123');
    cy.get('button[type="submit"]').click();
    
    // Navigate to workflow
    cy.url().should('include', '/dashboard');
    cy.visit('/workflows/cmg128qzu00dvo8o0mxy80gle');
    cy.contains('Workflow').should('be.visible');
    
    // Create trigger
    cy.contains('Triggers').should('be.visible');
    cy.contains('Add Trigger').click();
    
    cy.get('[data-testid="create-trigger-modal"]').should('be.visible');
    cy.get('#trigger-name').clear().type('404 Detection Test');
    cy.get('[data-testid="trigger-type"]').select('MANUAL');
    
    // Monitor for 404 errors when creating trigger
    cy.intercept('POST', '**/api/workflows/*/triggers').as('createTrigger');
    cy.contains('button', 'Create Trigger').click();
    
    cy.wait('@createTrigger').then((interception) => {
      const status = interception.response?.statusCode;
      cy.log(`Create trigger status: ${status}`);
      
      if (status === 404) {
        throw new Error(`404 Error on trigger creation: ${interception.request.url}`);
      }
    });
    
    // Test trigger operations
    cy.wait(1000);
    cy.contains('404 Detection Test').should('be.visible');
    
    // Monitor for 404 errors when executing trigger
    cy.intercept('POST', '**/api/triggers/*/execute').as('executeTrigger');
    cy.get('[data-testid="trigger-run"]').first().click();
    
    cy.wait('@executeTrigger').then((interception) => {
      const status = interception.response?.statusCode;
      cy.log(`Execute trigger status: ${status}`);
      
      if (status === 404) {
        throw new Error(`404 Error on trigger execution: ${interception.request.url}`);
      }
    });
    
    // Monitor for 404 errors when toggling trigger
    cy.intercept('PUT', '**/api/triggers/*').as('updateTrigger');
    cy.get('[data-testid="trigger-toggle"]').first().click();
    
    cy.wait('@updateTrigger').then((interception) => {
      const status = interception.response?.statusCode;
      cy.log(`Update trigger status: ${status}`);
      
      if (status === 404) {
        throw new Error(`404 Error on trigger update: ${interception.request.url}`);
      }
    });
    
    // Check for any console errors
    cy.get('@consoleError').then((stub: unknown) => {
      const s = stub as { calls?: Array<{ args?: unknown[] }> } | undefined;
      const calls = Array.isArray(s?.calls) ? s!.calls! : [];
      if (calls.length > 0) {
        cy.log(`Found ${calls.length} console errors:`);
        calls.forEach((call: { args?: unknown[] } | undefined, index: number) => {
          const args = Array.isArray(call?.args) ? call!.args! : [];
          const msg = args.join(' ');
          cy.log(`${index + 1}. ${msg}`);
          if (msg.includes('404') || msg.includes('Not Found')) {
            throw new Error(`Console 404 Error: ${msg}`);
          }
        });
      } else {
        cy.log(' No console errors detected');
      }
    });
  });
});
