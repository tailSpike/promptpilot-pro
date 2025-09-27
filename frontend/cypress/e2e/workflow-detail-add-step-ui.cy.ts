describe('Workflow Detail - Add Step button', () => {
  it('opens Add Step modal in editor and adds a step', () => {
    // Login
    cy.visit('/login');
    cy.get('input[type="email"]').type('test@example.com');
    cy.get('input[type="password"]').type('password123');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/dashboard');

    // Navigate to first workflow detail
    cy.window().then((win) => {
      const token = win.localStorage.getItem('token') || '';
      const apiUrl = Cypress.env('apiUrl') || 'http://localhost:3001';
      cy.request({
        method: 'GET',
        url: `${apiUrl}/api/workflows`,
        headers: { Authorization: `Bearer ${token}` }
      }).then((resp) => {
        const wf = resp.body.workflows && resp.body.workflows[0];
        cy.wrap(wf).should('exist');
        cy.visit(`/workflows/${wf.id}`);
      });
    });

    // Click Add Step on the detail card
    cy.get('[data-testid="detail-add-step-button"]').should('be.visible').click();
    cy.url().should('match', /\/workflows\/.+\/edit\?openAddStep=1/);

    // Modal should be visible
    cy.get('[data-testid="add-step-modal"]').should('be.visible');
      // Capture step count before cancel
      cy.get('[data-testid^="workflow-step-"]').its('length').then((beforeCount) => {
        // Cancel should not change step count
        cy.get('[data-testid="modal-cancel"]').click();
        cy.get('[data-testid^="workflow-step-"]').its('length').should('eq', beforeCount);

        // Re-open modal via query param
        cy.location('pathname').then((path) => {
          cy.visit(`${path}?openAddStep=1`);
        });
        cy.get('[data-testid="add-step-modal"]').should('be.visible');
        cy.get('[data-testid="modal-step-name"]').clear().type('Detail AddStep Test');
        cy.get('[data-testid="modal-step-type"]').select('TRANSFORM');

        // Intercept backend create
        cy.intercept('POST', '**/api/workflows/*/steps').as('createStep');

        // Add the step via modal
        cy.get('[data-testid="modal-add-step"]').click();
        cy.wait('@createStep');

        // Verify step count increased
        cy.get('[data-testid^="workflow-step-"]').its('length').should('eq', (beforeCount as number) + 1);
      });

      // Verify step appears in editor list with correct name and type
      cy.get('input[value="Detail AddStep Test"]').should('exist');
      cy.get('[data-testid^="workflow-step-"]').last().within(() => {
        cy.get('select[data-testid^="step-type-"]').should('have.value', 'TRANSFORM');
      });
  });
});
