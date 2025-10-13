/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      /** Find a single element by data-testid attribute */
      findByTestId(testId: string, options?: Partial<Timeoutable & Loggable>): Chainable<JQuery<HTMLElement>>;
      /** Find all elements by data-testid attribute */
      findAllByTestId(testId: string, options?: Partial<Timeoutable & Loggable>): Chainable<JQuery<HTMLElement>>;
    }
  }
}

export {};
