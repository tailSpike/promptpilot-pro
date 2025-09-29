/// <reference types="cypress" />

import { createWorkflowFixture, visitWithAuth, type WorkflowFixture } from '../support/regressionHelpers';

describe('Workflow management UI smoke', () => {
  let fixture: WorkflowFixture;

  before(() => {
    createWorkflowFixture('workflow-ui').then((created) => {
      fixture = created;
    });
  });

  it('provides navigation from list to creation form', () => {
    visitWithAuth('/workflows', fixture);
    cy.get('h1').contains(/workflows/i).should('be.visible');
    cy.contains(/new.*workflow/i).should('be.visible').click();
    cy.url().should('include', '/workflows/new');
    cy.get('form').should('exist');
  });

  it('validates required fields on the create workflow form', () => {
    visitWithAuth('/workflows/new', fixture);
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/workflows/new');
    cy.contains(/name/i).should('exist');
  });
});