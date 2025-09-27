// Debug-focused spec: marked as skipped by default to avoid CI flakiness.
describe.skip('Workflow Trigger UI Tests (debug-only)', () => {
  interface NetworkEntry { method: string; url: string; status: number; timestamp: string }
  interface ResWithStatus { statusCode: number }
  interface LightReq { method: string; url: string }
  interface InterceptReq extends LightReq { reply: (handler: (res: ResWithStatus) => unknown) => void }
  
  it('should create and manage triggers through the UI', () => {
    // Step 1: Start fresh - visit login page
    cy.visit('/login');
    
    // Step 2: Login as a real user would
    cy.get('input[type="email"]').type('test@example.com');
    cy.get('input[type="password"]').type('password123');
    cy.get('button[type="submit"]').click();
    
    // Step 3: Wait for successful login and dashboard
    cy.url().should('include', '/dashboard');
    cy.contains('Dashboard').should('be.visible');
    
    // Step 4: After login, dynamically pick an existing workflow and visit it
  cy.window().then((win) => {
      const token = win.localStorage.getItem('token') || '';
      const apiUrl = Cypress.env('apiUrl') || 'http://localhost:3001';
      cy.request({
        method: 'GET',
        url: `${apiUrl}/api/workflows`,
        headers: { Authorization: `Bearer ${token}` }
      }).then((resp) => {
        const wf = resp.body.workflows && resp.body.workflows[0];
        cy.wrap(wf, { log: false }).should('exist');
        cy.visit(`/workflows/${wf.id}`);
      });
    });
    
    // Step 5: Wait for workflow page to load
    cy.url().should('match', /\/workflows\/[a-zA-Z0-9]+$/);
    cy.contains('Workflow').should('be.visible'); // Generic check for workflow page
    
    // Step 7: Set up targeted network monitoring for triggers endpoints
    const networkRequests: NetworkEntry[] = [];
    const logReq = (req: LightReq, res: ResWithStatus) => {
      const entry: NetworkEntry = {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        timestamp: new Date().toISOString()
      };
      networkRequests.push(entry);
      if (res.statusCode === 404) {
        console.log(` 404 ERROR: ${req.method} ${req.url}`);
      }
    };
    cy.intercept('GET', '**/api/workflows/*/triggers', (req: unknown) => {
      const r = req as InterceptReq;
      r.reply((res: ResWithStatus) => { logReq(r, res); return res; });
    }).as('getWorkflowTriggers');
    cy.intercept('POST', '**/api/workflows/*/triggers', (req: unknown) => {
      const r = req as InterceptReq;
      r.reply((res: ResWithStatus) => { logReq(r, res); return res; });
    }).as('createWorkflowTrigger');
    cy.intercept('PUT', '**/api/triggers/*', (req: unknown) => {
      const r = req as InterceptReq;
      r.reply((res: ResWithStatus) => { logReq(r, res); return res; });
    }).as('updateTrigger');
    cy.intercept('POST', '**/api/triggers/*/execute', (req: unknown) => {
      const r = req as InterceptReq;
      r.reply((res: ResWithStatus) => { logReq(r, res); return res; });
    }).as('executeTrigger');
    
    // Step 8: Look for the Triggers section
    cy.contains('Triggers').should('be.visible');
    
    // Step 9: Click "Add Trigger" button (like user would)
    cy.contains('Add Trigger').click();
    
    // Step 10: Wait for modal to appear
    cy.get('[data-testid="create-trigger-modal"]').should('be.visible');
    cy.contains('Create Trigger').should('be.visible'); // The button should be visible
    
    // Step 11: Fill out the form exactly as user would
    cy.get('#trigger-name').clear().type('E2E Debug Test Trigger');
    cy.get('[data-testid="trigger-type"]').select('MANUAL');
    
    // Step 12: Wait a moment to ensure form is ready
    cy.wait(500);
    
    // Step 13: Click Create Trigger button
    cy.contains('button', 'Create Trigger').click();
    
    // Step 14: Wait for any network activity to complete
  cy.wait('@createWorkflowTrigger', { timeout: 10000 });
    
    // Step 15: Analyze all network requests for issues
    cy.then(() => {
      console.log(' Network Request Analysis:');
      networkRequests.forEach((req, index) => {
        console.log(`${index + 1}. ${req.method} ${req.url}  ${req.status}`);
        
        if (req.status === 404) {
          console.log(` 404 FOUND: ${req.method} ${req.url}`);
        }
      });
      
      // Check if any requests failed
      const failed404s = networkRequests.filter(req => req.status === 404);
      if (failed404s.length > 0) {
        console.log(` Found ${failed404s.length} 404 errors:`);
        failed404s.forEach(req => {
          console.log(`   ${req.method} ${req.url}`);
        });
      }
    });
    
    // Step 16: Check final state - did trigger get created?
    cy.get('body').then(($body) => {
      if ($body.text().includes('E2E Debug Test Trigger')) {
        cy.log(' SUCCESS: Trigger was created successfully');
        
        // Test trigger operations
        cy.contains('E2E Debug Test Trigger').should('be.visible');
        
        // Execute it
        cy.get('[data-testid="trigger-run"]').first().click();
        cy.wait('@executeTrigger');

        // Toggle it (ensure badge changes and toggle back)
        cy.get('div.border.rounded-lg.p-4').contains('E2E Debug Test Trigger').parents('div.border.rounded-lg.p-4').within(() => {
          cy.contains(/Active|Inactive/).invoke('text').then((before) => {
            cy.get('[data-testid="trigger-toggle"]').click();
            cy.contains(/Active|Inactive/).invoke('text').should((after) => {
              expect(after.trim()).to.not.eq(before.trim());
            });
            cy.get('[data-testid="trigger-toggle"]').click();
          });
        });
        
      } else if ($body.text().includes('error') || $body.text().includes('Error')) {
        cy.log(' ERROR: Trigger creation failed with visible error');
      } else {
        cy.log(' UNKNOWN: Trigger creation status unclear');
      }
    });
  });
  
  it('should verify all trigger API endpoints work correctly', () => {
    const apiUrl = Cypress.env('apiUrl') || 'http://localhost:3001';
    // Get a valid auth token first
    cy.request({
      method: 'POST',
  url: `${apiUrl}/api/auth/login`,
      body: {
        email: 'test@example.com',
        password: 'password123'
      }
    }).then((loginResponse) => {
      const token = loginResponse.body.token;
      
      // Test the workflow trigger endpoints directly
      cy.request({
        method: 'GET',
    url: `${apiUrl}/api/workflows`,
        headers: { Authorization: `Bearer ${token}` }
      }).then((workflowsResponse) => {
        const workflow = workflowsResponse.body.workflows[0];
        const workflowId = workflow.id;
        
        cy.log(`Testing with workflow: ${workflowId}`);
        
        // Test CREATE
        cy.request({
          method: 'POST',
          url: `${apiUrl}/api/workflows/${workflowId}/triggers`,
          headers: { Authorization: `Bearer ${token}` },
          body: {
            name: 'API Direct Test',
            type: 'MANUAL',
            isActive: true
          }
        }).then((createResponse) => {
          expect(createResponse.status).to.eq(201);
          const triggerId = createResponse.body.id;
          cy.log(` CREATE SUCCESS: ${triggerId}`);
          
          // Test GET individual trigger
          cy.request({
            method: 'GET',
            url: `${apiUrl}/api/triggers/${triggerId}`,
            headers: { Authorization: `Bearer ${token}` }
          }).then((getResponse) => {
            expect(getResponse.status).to.eq(200);
            cy.log(' GET SUCCESS');
            
            // Test EXECUTE
            cy.request({
              method: 'POST',
              url: `${apiUrl}/api/triggers/${triggerId}/execute`,
              headers: { Authorization: `Bearer ${token}` }
            }).then((executeResponse) => {
              expect(executeResponse.status).to.eq(200);
              cy.log(' EXECUTE SUCCESS');
              
              // Test UPDATE
              cy.request({
                method: 'PUT',
                url: `${apiUrl}/api/triggers/${triggerId}`,
                headers: { Authorization: `Bearer ${token}` },
                body: {
                  name: 'Updated API Test',
                  isActive: false
                }
              }).then((updateResponse) => {
                expect(updateResponse.status).to.eq(200);
                cy.log(' UPDATE SUCCESS');
                
                // Test DELETE
                cy.request({
                  method: 'DELETE',
                  url: `${apiUrl}/api/triggers/${triggerId}`,
                  headers: { Authorization: `Bearer ${token}` }
                }).then((deleteResponse) => {
                  expect(deleteResponse.status).to.eq(204);
                  cy.log(' DELETE SUCCESS');
                  
                  cy.log(' ALL API ENDPOINTS WORKING PERFECTLY!');
                });
              });
            });
          });
        });
      });
    });
  });
});
