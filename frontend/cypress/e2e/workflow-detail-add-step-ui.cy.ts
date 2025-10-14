describe('Workflow Detail - Add Step button', () => {
  const password = 'workflow-ui-pass-123!';
  const email = `workflow-detail-${Date.now()}@example.com`;
  let workflowId: string;

  before(() => {
    const apiUrl = Cypress.env('apiUrl') || 'http://localhost:3001';
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/auth/register`,
      body: {
        name: 'Workflow Detail Tester',
        email,
        password
      }
    }).then((response) => {
      const token = response.body.token as string;

      return cy.request({
        method: 'POST',
        url: `${apiUrl}/api/workflows`,
        headers: { Authorization: `Bearer ${token}` },
        body: {
          name: 'Workflow Detail Test Workflow',
          description: 'Seed workflow for detail add step UI test',
          steps: []
        }
      }).then((workflowResponse) => {
        workflowId = workflowResponse.body.id as string;
      });
    });
  });

  it('opens Add Step modal in editor and adds a step', () => {
    // Login
    cy.visit('/login');
    cy.get('input[type="email"]').type(email);
    cy.get('input[type="password"]').type(password);
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/dashboard');

    // Navigate directly to the seeded workflow detail
    cy.wrap(null).then(() => {
      expect(workflowId, 'workflow id should be seeded').to.be.a('string');
  expect(workflowId).to.not.equal('');
    });
    cy.visit(`/workflows/${workflowId}`);

    // Click Add Step on the detail card
    cy.get('[data-testid="detail-add-step-button"]').should('be.visible').click();
    cy.url().should('match', /\/workflows\/.+\/edit\?openAddStep=1/);

    // Modal should be visible
  cy.get('[data-testid="add-step-modal"]').should('be.visible');
    cy.get('body').then(($body) => {
      cy.wrap($body.find('[data-testid^="workflow-step-"]').length).as('initialStepCount');
    });

    // Cancel should not change step count
    cy.get('[data-testid="modal-cancel"]').click();
    cy.get<number>('@initialStepCount').then((initialCount) => {
      cy.get('body')
        .find('[data-testid^="workflow-step-"]')
        .should('have.length', initialCount);
    });

    // Re-open modal via query param
  cy.location('pathname').then((path) => cy.visit(`${path}?openAddStep=1`));
  cy.get('[data-testid="add-step-modal"]').should('be.visible');
  cy.get('[data-testid="modal-step-name"]').scrollIntoView().should('be.visible').and('not.be.disabled').clear().type('Detail AddStep Test', { force: true });
  cy.get('[data-testid="modal-step-type"]').should('be.visible').and('not.be.disabled').select('TRANSFORM', { force: true });

    // Intercept backend create
    cy.intercept('POST', '**/api/workflows/*/steps').as('createStep');

    // Add the step via modal
    cy.get('[data-testid="modal-add-step"]').click();
    cy.wait('@createStep').its('response.statusCode').should('eq', 201);

    // Verify step count increased
    cy.get<number>('@initialStepCount').then((initialCount) => {
      cy.get('body')
        .find('[data-testid^="workflow-step-"]')
        .should('have.length', initialCount + 1);
    });

    // Verify step appears in editor list with correct name and type
    cy.get('input[value="Detail AddStep Test"]').should('exist');
    cy.get('[data-testid^="workflow-step-"]').last().within(() => {
      cy.get('select[data-testid^="step-type-"]').should('have.value', 'TRANSFORM');
    });
  });
});
