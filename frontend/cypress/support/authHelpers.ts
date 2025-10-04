/// <reference types="cypress" />

export interface AuthSession {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

interface VisitOptions {
  apiUrl: string;
  email: string;
  password: string;
  path: string;
  onRefresh?: (auth: AuthSession) => void;
}

export const loginAndVisit = ({
  apiUrl,
  email,
  password,
  path,
  onRefresh,
}: VisitOptions): Cypress.Chainable<unknown> => {
  cy.clearCookies();
  cy.clearLocalStorage();

  return cy
    .request('POST', `${apiUrl}/api/auth/login`, {
      email,
      password,
    })
    .then((response) => {
      const refreshedAuth = response.body as AuthSession;
      onRefresh?.(refreshedAuth);

      return cy.visit(path, {
        onBeforeLoad(win) {
          win.localStorage.setItem('token', refreshedAuth.token);
          win.localStorage.setItem('user', JSON.stringify(refreshedAuth.user));
        },
      });
    });
};