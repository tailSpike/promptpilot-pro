/// <reference types="cypress" />

describe('Prompt library sharing', () => {
  const apiUrl = Cypress.env('apiUrl');
  const password = 'ShareTest!123';
  const ownerEmail = `owner-${Date.now()}@example.com`;
  const inviteeEmail = `invitee-${Date.now()}@example.com`;

  let ownerAuth: { token: string; user: { id: string; email: string; name: string } };
  let inviteeAuth: { token: string; user: { id: string; email: string; name: string } };
  let folderId: string;

  before(() => {
    cy.request('POST', `${apiUrl}/api/auth/register`, {
      name: 'Sharing Owner',
      email: ownerEmail,
      password,
    }).then((response) => {
      ownerAuth = response.body;
    });

    cy.request('POST', `${apiUrl}/api/auth/register`, {
      name: 'Sharing Invitee',
      email: inviteeEmail,
      password,
    }).then((response) => {
      inviteeAuth = response.body;
    });

    cy.then(() => {
      return cy.request({
        method: 'POST',
        url: `${apiUrl}/api/folders`,
        headers: {
          Authorization: `Bearer ${ownerAuth.token}`,
        },
        body: {
          name: 'Shared Campaign Library',
          description: 'Assets for the spring campaign',
        },
      });
    }).then((response) => {
      folderId = response.body.folder.id;
    });

    cy.then(() => {
      return cy.request({
        method: 'POST',
        url: `${apiUrl}/api/prompts`,
        headers: {
          Authorization: `Bearer ${ownerAuth.token}`,
        },
        body: {
          name: 'Shared Welcome Prompt',
          content: 'Welcome {{name}} to the campaign!',
          folderId,
          variables: [
            {
              name: 'name',
              type: 'text',
            },
          ],
        },
      });
    });
  });

  it('lets an owner share and an invitee access the library', () => {
    cy.clearLocalStorage();
    cy.clearCookies();

    cy.intercept('GET', `${apiUrl}/api/feature-flags`).as('featureFlags');

    cy.visit('/prompts', {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('token', ownerAuth.token);
        win.localStorage.setItem('user', JSON.stringify(ownerAuth.user));
      },
    });

    cy.wait('@featureFlags', { timeout: 15000 });

    cy.contains('Shared Campaign Library', { timeout: 15000 }).should('be.visible').click();

    cy.contains('button', 'Share library', { timeout: 15000 }).should('be.visible').click();

    cy.get('input#share-search').type(inviteeEmail.slice(0, 6));

    cy.get('[data-testid="share-search-result"]', { timeout: 10000 })
      .contains(inviteeEmail)
      .should('be.visible')
      .closest('[data-testid="share-search-result"]')
      .within(() => {
        cy.get('[data-testid="share-search-invite"]').click();
      });

    cy.contains(`Shared Shared Campaign Library with ${inviteeEmail}`, { timeout: 10000 }).should('be.visible');
    cy.get('[data-testid="share-member"]', { timeout: 10000 }).should('contain', inviteeEmail);

    cy.contains('button', 'Close').click();

    cy.clearLocalStorage();
    cy.clearCookies();

    cy.visit('/prompts', {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('token', inviteeAuth.token);
        win.localStorage.setItem('user', JSON.stringify(inviteeAuth.user));
      },
    });

    cy.wait('@featureFlags', { timeout: 15000 });

    cy.contains('button', 'Shared with me').click();

    cy.contains('Shared Campaign Library', { timeout: 15000 }).should('be.visible').click();

    cy.contains('Shared Welcome Prompt', { timeout: 15000 }).should('be.visible');
    cy.contains('No prompts available').should('not.exist');
    cy.contains('button', 'Share library').should('not.exist');
  });
});
