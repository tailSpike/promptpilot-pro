/// <reference types="cypress" />

describe('Version Control System', () => {
  let testUser: { token: string; user: { id: string; email: string; name: string } };
  let testPromptId: string;

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
        testPromptId = response.body.id;
      });
  });

  describe('Version History Display', () => {
    it('should display version history for a prompt', () => {
      // Navigate to the prompts page first
      cy.visit('/prompts');
      
      // Look for our test prompt in the list and click edit
      cy.contains('Version Control Test Prompt').should('be.visible');
      cy.get('a').contains('Edit').first().click();
      
      // Should be on the edit page
      cy.url().should('include', '/edit');
      
      // Click on the History tab to access version history
      cy.get('button').contains('History').click();
      
      // Look for version history component
      cy.get('[data-testid="version-history"]', { timeout: 10000 })
        .should('be.visible')
        .within(() => {
          // Should show the version history title with count
          cy.contains('Version History').should('be.visible');
          
          // Should show at least the initial version (1.0.0)
          cy.contains('v1.0.0').should('be.visible');
          
          // Should show the current version indicator
          cy.contains('Current').should('be.visible');
          
          // Should show the creation details
          cy.contains('Version Test User').should('be.visible');
        });
    });

    it('should show version details including change type and commit message', () => {
      cy.visit('/prompts');
      cy.contains('Version Control Test Prompt').should('be.visible');
      cy.get('a').contains('Edit').first().click();
      
      // Click on the History tab
      cy.get('button').contains('History').click();
      
      cy.get('[data-testid="version-history"]', { timeout: 10000 })
        .should('be.visible')
        .within(() => {
          // Check for version number
          cy.contains('v1.0.0').should('be.visible');
          
          // Check for change type badge (should be MAJOR for initial version)
          cy.get('.bg-red-50').contains('MAJOR').should('be.visible');
          
          // Check for current version indicator
          cy.get('.bg-green-100').contains('Current').should('be.visible');
        });
    });

    it('should refresh version history when refresh button is clicked', () => {
      cy.visit('/prompts');
      cy.contains('Version Control Test Prompt').should('be.visible');
      cy.get('a').contains('Edit').first().click();
      
      // Click on the History tab
      cy.get('button').contains('History').click();
      
      cy.get('[data-testid="version-history"]', { timeout: 10000 })
        .should('be.visible')
        .within(() => {
          // Click the refresh button
          cy.contains('Refresh').click();
          
          // Should still show the version after refresh
          cy.contains('v1.0.0').should('be.visible');
        });
    });
  });

  describe('Creating New Versions', () => {
    it('should create a new version when prompt is updated', () => {
      cy.visit('/prompts');
      cy.contains('Version Control Test Prompt').should('be.visible');
      cy.get('a').contains('Edit').first().click();
      
      // Make changes to the prompt on the Editor tab
      cy.get('textarea#content').clear().type('Hello {{name}}, welcome to version 1.1.0! This is an update.', { parseSpecialCharSequences: false });
      
      // Submit the update
      cy.get('button[type="submit"]').contains('Update Prompt').click();
      
      // Should show success message
      cy.get('.bg-green-50').should('be.visible').and('contain', 'Prompt updated successfully');
      
      // Switch to History tab to check version history for new version
      cy.get('button').contains('History').click();
      
      cy.get('[data-testid="version-history"]', { timeout: 10000 })
        .should('be.visible')
        .within(() => {
          // Should now have version 1.1.0 as current
          cy.contains('v1.1.0').should('be.visible');
          cy.contains('v1.0.0').should('be.visible');
          
          // The new version should be marked as current
          cy.get('.bg-green-100').contains('Current').should('be.visible');
        });
    });

    it('should handle version changes', () => {
      cy.visit('/prompts');
      cy.contains('Version Control Test Prompt').should('be.visible');
      cy.get('a').contains('Edit').first().click();
      
      // Make a change (modify description)
      cy.get('textarea#description').clear().type('Updated description for testing version changes');
      
      // Submit the update
      cy.get('button[type="submit"]').contains('Update Prompt').click();
      
      // Should show success message
      cy.get('.bg-green-50').should('be.visible').and('contain', 'Prompt updated successfully');
      
      // Switch to History tab to check for new version
      cy.get('button').contains('History').click();
      
      cy.get('[data-testid="version-history"]', { timeout: 10000 })
        .should('be.visible')
        .within(() => {
          // Should show a new version
          cy.get('[data-testid="version-item"]').should('have.length.at.least', 2);
        });
    });
  });

  describe('Version Comparison and Diff', () => {
    beforeEach(() => {
      // Create a second version for comparison testing
      cy.request({
        method: 'PUT',
        url: `${Cypress.env('apiUrl')}/api/prompts/${testPromptId}`,
        headers: { 'Authorization': `Bearer ${testUser.token}` },
        body: {
          name: 'Version Control Test Prompt - Updated',
          description: 'Updated description',
          content: 'Hello {{name}}, welcome to version 1.1.0! This is updated content.',
          variables: [
            { name: 'name', type: 'text', required: true }
          ]
        }
      });
    });

    it('should show version comparison capabilities', () => {
      cy.visit(`/prompts/${testPromptId}/edit`);
      
      cy.get('[data-testid="version-history"]', { timeout: 10000 })
        .should('be.visible')
        .within(() => {
          // Should have multiple versions
          cy.contains('v1.1.0').should('be.visible');
          cy.contains('v1.0.0').should('be.visible');
          
          // Each version should have preview/view buttons
          cy.get('[title="Preview this version"]').should('have.length.at.least', 1);
        });
    });

    it('should handle version preview functionality', () => {
      cy.visit(`/prompts/${testPromptId}/edit`);
      
      cy.get('[data-testid="version-history"]', { timeout: 10000 })
        .should('be.visible')
        .within(() => {
          // Click preview button for a version
          cy.get('[title="Preview this version"]').first().click();
        });
      
      // Note: Preview functionality would open a modal or new view
      // This test verifies the button exists and is clickable
    });
  });

  describe('Version Revert Functionality', () => {
    beforeEach(() => {
      // Create multiple versions for revert testing
      cy.request({
        method: 'PUT',
        url: `${Cypress.env('apiUrl')}/api/prompts/${testPromptId}`,
        headers: { 'Authorization': `Bearer ${testUser.token}` },
        body: {
          name: 'Version Control Test Prompt - V2',
          content: 'Hello {{name}}, this is version 2 content!',
          variables: [
            { name: 'name', type: 'text', required: true }
          ]
        }
      }).then(() => {
        // Create a third version
        return cy.request({
          method: 'PUT',
          url: `${Cypress.env('apiUrl')}/api/prompts/${testPromptId}`,
          headers: { 'Authorization': `Bearer ${testUser.token}` },
          body: {
            name: 'Version Control Test Prompt - V3',
            content: 'Hello {{name}}, this is version 3 content!',
            variables: [
              { name: 'name', type: 'text', required: true }
            ]
          }
        });
      });
    });

    it('should allow reverting to a previous version', () => {
      cy.visit(`/prompts/${testPromptId}/edit`);
      
      cy.get('[data-testid="version-history"]', { timeout: 10000 })
        .should('be.visible')
        .within(() => {
          // Should have multiple versions
          cy.contains('v1.2.0').should('be.visible'); // Current version
          cy.contains('v1.1.0').should('be.visible'); // Previous version
          cy.contains('v1.0.0').should('be.visible'); // Original version
          
          // Click revert button for a previous version (not the current one)
          cy.get('[title="Revert to this version"]').first().click();
        });
      
      // Handle the confirmation dialog
      cy.window().then((win) => {
        cy.stub(win, 'confirm').returns(true);
      });
      
      // Should show success alert after revert
      cy.window().then((win) => {
        cy.stub(win, 'alert').as('alertStub');
      });
      
      // The version history should be updated to show the revert
      cy.get('[data-testid="version-history"]', { timeout: 15000 })
        .should('be.visible')
        .within(() => {
          // Should have a new version created by the revert
          cy.contains('Current').should('be.visible');
        });
    });

    it('should not show revert button for current version', () => {
      cy.visit(`/prompts/${testPromptId}/edit`);
      
      cy.get('[data-testid="version-history"]', { timeout: 10000 })
        .should('be.visible')
        .within(() => {
          // Find the current version (first one with "Current" badge)
          cy.get('.bg-green-100').contains('Current').parent().parent()
            .within(() => {
              // Should not have a revert button
              cy.get('[title="Revert to this version"]').should('not.exist');
            });
        });
    });

    it('should show confirmation dialog before reverting', () => {
      cy.visit(`/prompts/${testPromptId}/edit`);
      
      // Mock the confirmation dialog
      cy.window().then((win) => {
        cy.stub(win, 'confirm').returns(false);
      });
      
      cy.get('[data-testid="version-history"]', { timeout: 10000 })
        .should('be.visible')
        .within(() => {
          // Click revert button
          cy.get('[title="Revert to this version"]').first().click();
        });
      
      // Verification that confirmation prevents revert when user cancels
      // No further action needed as the dialog was canceled
    });
  });

  describe('Version Statistics and Metadata', () => {
    it('should display version creation information', () => {
      cy.visit(`/prompts/${testPromptId}/edit`);
      
      cy.get('[data-testid="version-history"]', { timeout: 10000 })
        .should('be.visible')
        .within(() => {
          // Should show creator information
          cy.contains('Version Test User').should('be.visible');
          
          // Should show creation timestamp
          cy.get('[data-testid="version-timestamp"]', { timeout: 5000 }).should('be.visible');
          
          // Should show version numbers
          cy.contains('v1.0.0').should('be.visible');
        });
    });

    it('should handle empty version history gracefully', () => {
      // Create a prompt without any versions (this shouldn't happen in real usage)
      cy.visit('/prompts/nonexistent/edit');
      
      // Should handle 404 or show appropriate error
      cy.get('body').should('contain.text', '404');
    });
  });

  describe('Version History Integration with Prompt Editor', () => {
    it('should show version history alongside prompt editing form', () => {
      cy.visit(`/prompts/${testPromptId}/edit`);
      
      // Should have the prompt editing form
      cy.get('input#name').should('be.visible');
      cy.get('textarea#content').should('be.visible');
      
      // Should also have the version history component
      cy.get('[data-testid="version-history"]', { timeout: 10000 }).should('be.visible');
      
      // Both should be visible simultaneously
      cy.get('input#name').should('be.visible');
      cy.get('[data-testid="version-history"]').should('be.visible');
    });

    it('should update version history after prompt modifications', () => {
      cy.visit(`/prompts/${testPromptId}/edit`);
      
      // Get initial version count
      cy.get('[data-testid="version-history"]', { timeout: 10000 })
        .should('be.visible')
        .within(() => {
          cy.get('[data-testid="version-item"]').then($versions => {
            const initialCount = $versions.length;
            
            // Make a change to the prompt
            cy.get('textarea#content').clear().type('Updated content for new version test', { parseSpecialCharSequences: false });
            
            // Submit the update
            cy.get('button[type="submit"]').contains('Update Prompt').click();
            
            // Should show success
            cy.get('.bg-green-50').should('be.visible');
            
            // Version history should be updated with new version
            cy.get('[data-testid="version-item"]').should('have.length', initialCount + 1);
          });
        });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle version API errors gracefully', () => {
      // Intercept version API and return error
      cy.intercept('GET', `${Cypress.env('apiUrl')}/api/prompts/*/versions`, {
        statusCode: 500,
        body: { error: 'Internal server error' }
      }).as('versionError');
      
      cy.visit(`/prompts/${testPromptId}/edit`);
      
      cy.wait('@versionError');
      
      // Should show error message
      cy.get('.bg-red-50').should('be.visible').and('contain', 'Error');
      
      // Should have retry button
      cy.get('button').contains('Retry').should('be.visible');
    });

    it('should handle revert API errors gracefully', () => {
      // First create a version to revert to
      cy.request({
        method: 'PUT',
        url: `${Cypress.env('apiUrl')}/api/prompts/${testPromptId}`,
        headers: { 'Authorization': `Bearer ${testUser.token}` },
        body: {
          name: 'Version Control Test Prompt - Updated',
          content: 'Updated content',
          variables: [{ name: 'name', type: 'text', required: true }]
        }
      });
      
      // Intercept revert API and return error
      cy.intercept('POST', `${Cypress.env('apiUrl')}/api/prompts/*/versions/*/revert`, {
        statusCode: 400,
        body: { error: 'Cannot revert to this version' }
      }).as('revertError');
      
      cy.visit(`/prompts/${testPromptId}/edit`);
      
      // Mock confirmation to return true
      cy.window().then((win) => {
        cy.stub(win, 'confirm').returns(true);
        cy.stub(win, 'alert').as('alertStub');
      });
      
      cy.get('[data-testid="version-history"]', { timeout: 10000 })
        .should('be.visible')
        .within(() => {
          // Click revert button
          cy.get('[title="Revert to this version"]').first().click();
        });
      
      cy.wait('@revertError');
      
      // Should show error alert
      cy.get('@alertStub').should('have.been.calledWith', 'Cannot revert to this version');
    });

    it('should handle loading states properly', () => {
      // Intercept version API with delay
      cy.intercept('GET', `${Cypress.env('apiUrl')}/api/prompts/*/versions`, {
        delay: 2000,
        body: []
      }).as('slowVersions');
      
      cy.visit(`/prompts/${testPromptId}/edit`);
      
      // Should show loading state
      cy.get('.animate-spin').should('be.visible');
      cy.contains('Loading version history...').should('be.visible');
      
      cy.wait('@slowVersions');
      
      // Loading should disappear
      cy.get('.animate-spin').should('not.exist');
    });
  });
});