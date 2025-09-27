// Diagnostic-only; keep skipped
describe.skip('Workflow Trigger Debug with Console Logs', () => {
  
  it('should capture all browser console logs and network errors during trigger creation', () => {
    type ConsoleLogEntry = { type: 'log' | 'error' | 'warn'; message: string; timestamp: string };
    type NetworkErrorEntry = { method: string; url: string; status: number; timestamp: string };

    const consoleLogs: ConsoleLogEntry[] = [];
    const networkErrors: NetworkErrorEntry[] = [];
    
    // Step 1: Set up console log capture BEFORE visiting any page
    cy.visit('/login', {
      onBeforeLoad: (win) => {
        // Override console methods to capture logs
        const originalLog = win.console.log;
        const originalError = win.console.error;
        const originalWarn = win.console.warn;
        
        win.console.log = function(...args: unknown[]) {
          const message = args.join(' ');
          consoleLogs.push({ type: 'log', message, timestamp: new Date().toISOString() });
          originalLog.apply(win.console, args);
        };
        
        win.console.error = function(...args: unknown[]) {
          const message = args.join(' ');
          consoleLogs.push({ type: 'error', message, timestamp: new Date().toISOString() });
          originalError.apply(win.console, args);
        };
        
        win.console.warn = function(...args: unknown[]) {
          const message = args.join(' ');
          consoleLogs.push({ type: 'warn', message, timestamp: new Date().toISOString() });
          originalWarn.apply(win.console, args);
        };
      }
    });
    
    // Step 2: Set up network error capture
    cy.intercept('**/*', (req) => {
      req.reply((res) => {
        // Capture any HTTP errors
        if (res.statusCode >= 400) {
          const errorEntry = {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            timestamp: new Date().toISOString()
          };
          networkErrors.push(errorEntry);

          // Note: Avoid using cy.* commands inside intercept callbacks to prevent
          // Cypress promise/command mixing errors. We'll log these later in a cy.then.
        }
        
        return res;
      });
    }).as('networkRequests');
    
    // Step 3: Login
    cy.get('input[type="email"]').type('test@example.com');
    cy.get('input[type="password"]').type('password123');
    cy.get('button[type="submit"]').click();
    
    // Step 4: Navigate to workflow
    cy.url().should('include', '/dashboard');
    cy.visit('/workflows/cmg128qzu00dvo8o0mxy80gle');
    cy.contains('Workflow').should('be.visible');
    
    // Step 5: Create trigger and capture everything
    cy.contains('Triggers').should('be.visible');
    cy.contains('Add Trigger').click();
    
    cy.get('[data-testid="create-trigger-modal"]').should('be.visible');
    cy.get('#trigger-name').clear().type('Console Log Debug Test');
    cy.get('[data-testid="trigger-type"]').select('MANUAL');
    
    // Create the trigger
    cy.contains('button', 'Create Trigger').click();
    
    // Wait for any async operations
    cy.wait(3000);
    
    // Step 6: Test trigger operations that might cause 404s
    cy.get('body').then(($body) => {
      if ($body.text().includes('Console Log Debug Test')) {
        cy.log(' Trigger created - testing operations');
        
        // Execute trigger
        cy.get('[data-testid="trigger-run"]').first().click();
        cy.wait(1000);
        
        // Toggle trigger
        cy.get('[data-testid="trigger-toggle"]').first().click();
        cy.wait(1000);
      }
    });
    
    // Step 7: Analyze all captured data
    cy.then(() => {
      cy.log(' CONSOLE LOGS ANALYSIS:');
      consoleLogs.forEach((log, index) => {
        cy.log(`${index + 1}. [${log.type.toUpperCase()}] ${log.message}`);
        
        // Look for 404 errors in console
        if (log.message.includes('404') || log.message.includes('Not Found')) {
          cy.log(` CONSOLE 404 ERROR: ${log.message}`);
        }
      });
      
      cy.log(' NETWORK ERRORS ANALYSIS:');
      networkErrors.forEach((error, index) => {
        cy.log(`${index + 1}. HTTP ${error.status}: ${error.method} ${error.url}`);
        
        if (error.status === 404) {
          cy.log(` NETWORK 404 ERROR: ${error.method} ${error.url}`);
          // Force test failure if we find 404s
          throw new Error(`404 Error detected: ${error.method} ${error.url}`);
        }
      });
      
      // Summary
      const errorLogs = consoleLogs.filter(log => log.type === 'error');
      const warnLogs = consoleLogs.filter(log => log.type === 'warn');
      
      cy.log(` SUMMARY:`);
      cy.log(`   Console Errors: ${errorLogs.length}`);
      cy.log(`   Console Warnings: ${warnLogs.length}`);
      cy.log(`   Network Errors: ${networkErrors.length}`);
      cy.log(`   Total Console Logs: ${consoleLogs.length}`);
      
      if (errorLogs.length > 0 || networkErrors.length > 0) {
        cy.log(' ERRORS DETECTED - Check logs above for details');
      } else {
        cy.log(' NO ERRORS DETECTED');
      }
    });
  });
});
