/// <reference types="cypress" />

function sanitiseBody(raw: string) {
  return raw
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

describe('Prompt comment collaboration', () => {
  const apiUrl = Cypress.env('apiUrl');

  const ownerEmail = `owner-${Date.now()}@example.com`;
  const reviewerEmail = `reviewer-${Date.now()}@example.com`;
  const outsiderEmail = `outsider-${Date.now()}@example.com`;
  const password = 'CommentSpec!123';

  let ownerAuth: { token: string; user: { id: string; email: string; name: string } };
  let reviewerAuth: { token: string; user: { id: string; email: string; name: string } };
  let outsiderAuth: { token: string; user: { id: string; email: string; name: string } };
  let folderId: string;
  let promptId: string;
  let uiPromptId: string | undefined;
  let uiPromptPath: string | undefined;
  const sharedLibraryName = 'Comment Test Library';

  const visitAs = (auth: { token: string; user: { id: string; email: string; name: string } }, path: string) => {
    cy.clearCookies();
    cy.clearLocalStorage();

    return cy
      .request('POST', `${apiUrl}/api/auth/login`, {
        email: auth.user.email,
        password,
      })
      .then((response) => {
        const refreshedAuth = response.body as typeof auth;

        if (auth.user.email === ownerEmail) {
          ownerAuth = refreshedAuth;
        } else if (auth.user.email === reviewerEmail) {
          reviewerAuth = refreshedAuth;
        } else if (auth.user.email === outsiderEmail) {
          outsiderAuth = refreshedAuth;
        }

        return cy.visit(path, {
          onBeforeLoad(win) {
            win.localStorage.setItem('token', refreshedAuth.token);
            win.localStorage.setItem('user', JSON.stringify(refreshedAuth.user));
          },
        });
      });
  };

  before(() => {
    cy.task('e2e:ensureServers');

    if (!Cypress.config('isInteractive')) {
      cy.exec('npm --prefix ../backend run db:reset:test', {
        timeout: 120000,
      });
    } else {
      cy.log('Interactive mode detected: skipping DB reset (servers started by Cypress task).');
    }

    cy.request('POST', `${apiUrl}/api/auth/register`, {
      name: 'Comment Owner',
      email: ownerEmail,
      password,
    }).then((response) => {
      ownerAuth = response.body;
    });

    cy.request('POST', `${apiUrl}/api/auth/register`, {
      name: 'Comment Reviewer',
      email: reviewerEmail,
      password,
    }).then((response) => {
      reviewerAuth = response.body;
    });

    cy.request('POST', `${apiUrl}/api/auth/register`, {
      name: 'Comment Outsider',
      email: outsiderEmail,
      password,
    }).then((response) => {
      outsiderAuth = response.body;
    });

    cy.then(() => {
      return cy
        .request({
          method: 'POST',
          url: `${apiUrl}/api/folders`,
          headers: {
            Authorization: `Bearer ${ownerAuth.token}`,
          },
          body: {
            name: sharedLibraryName,
            description: 'Shared library for comment specs',
          },
        })
        .then((response) => {
          folderId = response.body.folder.id;
        });
    });

    cy.then(() => {
      return cy
        .request({
          method: 'POST',
          url: `${apiUrl}/api/prompts`,
          headers: {
            Authorization: `Bearer ${ownerAuth.token}`,
          },
          body: {
            name: 'Shared Prompt For Comments',
            content: 'Draft prompt content with {{variable}} placeholder.',
            folderId,
            variables: [
              {
                name: 'variable',
                type: 'text',
              },
            ],
          },
        })
        .then((response) => {
          promptId = response.body.prompt.id;
        });
    });

    cy.then(() => {
      return cy.request({
        method: 'POST',
        url: `${apiUrl}/api/libraries/${folderId}/shares`,
        headers: {
          Authorization: `Bearer ${ownerAuth.token}`,
        },
        body: {
          inviteeEmail: reviewerEmail,
        },
      });
    });
  });

  it('enables owners and shared reviewers to collaborate on prompt feedback via the UI', () => {
    const uniqueSuffix = Date.now();
    const promptName = `UI Collaboration Prompt ${uniqueSuffix}`;
    const promptDescription = 'Prompt created via UI to validate collaborative feedback flow.';
    const promptContent = `Write a welcome message for {{audience}} cohort ${uniqueSuffix}.`;
    const reviewerComment = `Reviewer feedback cycle ${uniqueSuffix}`;
    const ownerReply = `Owner acknowledgement ${uniqueSuffix}`;

  visitAs(ownerAuth, '/prompts/new');
    cy.url({ timeout: 15000 }).should('include', '/prompts/new');
  cy.contains('h1', 'Create New Prompt', { timeout: 20000 }).should('be.visible');

    cy.get('[data-testid="prompt-name"]', { timeout: 20000 })
      .should('be.visible')
      .and('not.be.disabled')
      .type(promptName);
    cy.get('[data-testid="prompt-description"], textarea#description', { timeout: 20000 })
      .should('be.visible')
      .type(promptDescription);
    cy.get('textarea#content', { timeout: 15000 })
      .should('be.visible')
      .type(promptContent, { parseSpecialCharSequences: false });
    cy.get('select#folder').select(sharedLibraryName);

  cy.contains('button', 'Create Prompt').should('be.enabled').click();
    cy.get('.bg-green-50', { timeout: 15000 })
      .should('be.visible')
      .and('contain', 'Prompt created successfully');

    cy.url({ timeout: 15000 }).should('include', '/prompts');
    cy.contains('h3', promptName, { timeout: 15000 })
      .parents('div.rounded-lg')
      .first()
      .within(() => {
        cy.contains('View').click();
      });

    cy.location('pathname', { timeout: 15000 }).should('match', /\/prompts\//);
    cy.location('pathname').then((pathname) => {
      uiPromptPath = pathname;
      uiPromptId = pathname.split('/').pop();
    });

    cy.contains('h2', 'Feedback', { timeout: 10000 }).should('be.visible');
    cy.contains('No feedback yet', { timeout: 10000 }).should('be.visible');

  visitAs(reviewerAuth, '/prompts');

    cy.get('[data-testid="view-mode-shared"]', { timeout: 15000 }).click();
    cy.contains('[data-testid="shared-library-list-item"]', sharedLibraryName, { timeout: 15000 }).click();

    cy.contains('[data-testid="shared-library-prompts"] h3', promptName, { timeout: 15000 })
      .parents('div.rounded-lg')
      .first()
      .within(() => {
        cy.contains('View').click();
      });

    cy.location('pathname', { timeout: 15000 }).should((pathname) => {
      expect(uiPromptId, 'prompt id to be captured from owner flow').to.be.a('string');
      expect(pathname).to.include(uiPromptId!);
    });

    cy.contains('h1', promptName, { timeout: 10000 }).should('be.visible');
    cy.contains('No feedback yet', { timeout: 10000 }).should('be.visible');

  cy.intercept('POST', '**/api/prompts/**/comments').as('postReviewerComment');

    cy.get('textarea[placeholder="Leave feedback for collaborators..."]', { timeout: 10000 })
      .should('be.enabled')
      .type(reviewerComment);
    cy.contains('button', 'Post feedback').click();
    cy.wait('@postReviewerComment').its('response.statusCode').should('eq', 201);

    cy.contains('p', reviewerComment, { timeout: 10000 }).should('be.visible');
    cy.contains('.text-sm.font-medium.text-gray-900', reviewerAuth.user.name).should('be.visible');

    cy.then(() => {
      expect(uiPromptPath, 'prompt path to be captured from owner flow').to.be.a('string');
      return visitAs(ownerAuth, uiPromptPath!);
    });

    cy.contains('p', reviewerComment, { timeout: 10000 }).should('be.visible');
  cy.intercept('POST', '**/api/prompts/**/comments').as('postOwnerComment');

    cy.get('textarea[placeholder="Leave feedback for collaborators..."]', { timeout: 10000 })
      .should('be.enabled')
      .type(ownerReply);
    cy.contains('button', 'Post feedback').click();
    cy.wait('@postOwnerComment').its('response.statusCode').should('eq', 201);

    cy.contains('p', ownerReply, { timeout: 10000 }).should('be.visible');
    cy.contains('p', reviewerComment).should('be.visible');
    cy.contains('.text-sm.font-medium.text-gray-900', ownerAuth.user.name).should('be.visible');

    cy.then(() => {
      expect(uiPromptPath, 'prompt path for reviewer recheck').to.be.a('string');
      return visitAs(reviewerAuth, uiPromptPath!);
    });

    cy.contains('p', reviewerComment, { timeout: 10000 }).should('be.visible');
    cy.contains('p', ownerReply, { timeout: 10000 }).should('be.visible');
    cy.contains('.text-sm.font-medium.text-gray-900', ownerAuth.user.name).should('be.visible');
  });

  it('allows a shared reviewer to create, list, and delete prompt comments', () => {
    const rawBody = "Thanks for the update <script>alert('x')</script>";
    const expectedSanitised = sanitiseBody(rawBody);

    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/prompts/${promptId}/comments`,
      headers: {
        Authorization: `Bearer ${reviewerAuth.token}`,
      },
      body: {
        body: rawBody,
      },
    }).then((response) => {
      expect(response.status).to.eq(201);
      expect(response.body.comment.body).to.eq(expectedSanitised);
      expect(response.body.comment.author.id).to.eq(reviewerAuth.user.id);
    });

    let commentId: string | undefined;

    cy.request({
      method: 'GET',
      url: `${apiUrl}/api/prompts/${promptId}/comments`,
      headers: {
        Authorization: `Bearer ${ownerAuth.token}`,
      },
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.libraryId).to.eq(folderId);
      expect(response.body.comments).to.have.length(1);
      commentId = response.body.comments[0].id;
      expect(response.body.comments[0].body).to.eq(expectedSanitised);
      expect(response.body.comments[0].author.email).to.eq(reviewerEmail);
    });

    cy.then(() => {
      expect(commentId, 'comment id to delete').to.be.a('string');
      const idToDelete = commentId as string;
      return cy.request({
        method: 'DELETE',
        url: `${apiUrl}/api/comments/${idToDelete}`,
        headers: {
          Authorization: `Bearer ${ownerAuth.token}`,
        },
      });
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.message).to.contain('Comment deleted');
    });

    cy.request({
      method: 'GET',
      url: `${apiUrl}/api/prompts/${promptId}/comments`,
      headers: {
        Authorization: `Bearer ${reviewerAuth.token}`,
      },
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.comments).to.have.length(0);
    });
  });

  it('blocks users without shared access from posting comments', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/api/prompts/${promptId}/comments`,
      headers: {
        Authorization: `Bearer ${outsiderAuth.token}`,
      },
      failOnStatusCode: false,
      body: {
        body: 'Trying to sneak a comment',
      },
    }).then((response) => {
      expect(response.status).to.eq(400);
      expect(response.body.error.message).to.match(/access denied/i);
    });
  });
});
