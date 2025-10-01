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
    cy.intercept('GET', `${apiUrl}/api/users/search*`).as('searchMembers');
    cy.intercept('POST', `${apiUrl}/api/libraries/*/shares`).as('createShare');
    cy.intercept('GET', `${apiUrl}/api/libraries/shared-with-me`).as('sharedWithMe');

    cy.visit('/prompts', {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('token', ownerAuth.token);
        win.localStorage.setItem('user', JSON.stringify(ownerAuth.user));
      },
    });

    cy.wait('@featureFlags', { timeout: 15000 });

    cy.get('[data-testid="folder-tree"]', { timeout: 15000 })
      .contains('[data-testid="folder-tree-item"]', 'Shared Campaign Library')
      .click();

  cy.get('[data-testid="share-library-button"]', { timeout: 15000 }).should('be.visible').click();
  cy.get('[data-testid="share-library-modal"]', { timeout: 10000 }).should('be.visible');

    cy.get('input#share-search').type(inviteeEmail.slice(0, 6));

    cy.wait('@searchMembers', { timeout: 15000 });

    cy.get('[data-testid="share-search-result"]', { timeout: 10000 })
      .contains(inviteeEmail)
      .should('be.visible')
      .closest('[data-testid="share-search-result"]')
      .within(() => {
        cy.get('[data-testid="share-search-invite"]').click();
      });

    cy.wait('@createShare', { timeout: 15000 });

    cy.get('[data-testid="share-modal-toast"]', { timeout: 10000 }).should('contain', inviteeEmail);
    cy.get('[data-testid="share-member-list"]', { timeout: 10000 }).should('contain', inviteeEmail);
    cy.get('[data-testid="prompt-list-toast"]', { timeout: 10000 }).should('contain', inviteeEmail);

    cy.get('[data-testid="share-modal-close"]').click();
    cy.get('[data-testid="share-library-modal"]').should('not.exist');

    cy.clearLocalStorage();
    cy.clearCookies();

    cy.visit('/prompts', {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('token', inviteeAuth.token);
        win.localStorage.setItem('user', JSON.stringify(inviteeAuth.user));
      },
    });

    cy.wait('@featureFlags', { timeout: 15000 });

    cy.get('[data-testid="view-mode-shared"]').click();

    cy.wait('@sharedWithMe', { timeout: 15000 });

    cy.get('[data-testid="shared-library-list"]', { timeout: 15000 }).should('contain', 'Shared Campaign Library');

    cy.get(`[data-testid="shared-library-list-item"][data-library-id="${folderId}"]`, { timeout: 15000 }).click();

    cy.get('[data-testid="shared-library-detail"]', { timeout: 15000 }).should('contain', 'Shared Campaign Library');
    cy.get('[data-testid="shared-library-prompts"]', { timeout: 15000 }).should('contain', 'Shared Welcome Prompt');
    cy.get('[data-testid="shared-library-prompts"]', { timeout: 15000 }).should('not.contain', 'No prompts available');
    cy.get('[data-testid="share-library-button"]').should('not.exist');
  });
});
