/// <reference types="cypress" />

describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    cy.visit('/');
  });

  describe('User Registration', () => {
    it('should register new user successfully', () => {
      const timestamp = Date.now();
      const userData = {
        name: `Test User ${timestamp}`,
        email: `test-${timestamp}@example.com`,
        password: 'securepassword123'
      };

      // Should be redirected to login when not authenticated
      cy.url().should('include', '/login');
      
      // Click register link from login page
      cy.get('a[href="/register"]').click();
      cy.url().should('include', '/register');

      // Fill registration form
      cy.get('input[name="name"], [data-testid="name-input"]').type(userData.name);
      cy.get('input[name="email"], [data-testid="email-input"]').type(userData.email);
      cy.get('input[name="password"], [data-testid="password-input"]').type(userData.password);
      cy.get('input[name="confirmPassword"], [data-testid="confirm-password-input"]').type(userData.password);

      // Submit registration
      cy.get('button[type="submit"], [data-testid="register-button"]').click();

      // Verify successful registration
      cy.url().should('not.include', '/register');
      cy.url().should('include', '/dashboard');
    });

    it('should show validation errors for invalid registration', () => {
      // Should be redirected to login when not authenticated
      cy.url().should('include', '/login');
      
      // Click register link from login page
      cy.get('a[href="/register"]').click();

      // Try to submit empty form
      cy.get('button[type="submit"]').click();

      // Should stay on registration page due to browser validation
      cy.url().should('include', '/register');
    });

    it('should prevent registration with mismatched passwords', () => {
      // Should be redirected to login when not authenticated
      cy.url().should('include', '/login');
      
      // Click register link from login page
      cy.get('a[href="/register"]').click();

      cy.get('input[name="name"]').type('Test User');
      cy.get('input[name="email"]').type(`test-${Date.now()}@example.com`);
      cy.get('input[name="password"]').type('password123');
      cy.get('input[name="confirmPassword"]').type('differentpassword');

      cy.get('button[type="submit"]').click();

      cy.get('.bg-red-50').should('be.visible').and('contain', 'Passwords do not match');
    });
  });

  describe('User Login', () => {
    beforeEach(() => {
      // Create a test user via API
      const userData = {
        name: 'Login Test User',
        email: `login-test-${Date.now()}@example.com`,
        password: 'testpassword123'
      };

      cy.request({
        method: 'POST',
        url: `${Cypress.env('apiUrl')}/api/auth/register`,
        body: userData
      }).as('testUser');
    });

    it('should login with valid credentials', function() {
      const { body } = this.testUser;
      
      // Should already be on login page when not authenticated
      cy.url().should('include', '/login');

      cy.get('input[name="email"], [data-testid="email-input"]').type(body.user.email);
      cy.get('input[name="password"], [data-testid="password-input"]').type('testpassword123');

      cy.get('button[type="submit"], [data-testid="login-button"]').click();

      cy.url().should('include', '/dashboard');
      cy.get('h1').should('contain', 'Welcome back');
    });

    it('should reject invalid login credentials', () => {
      // Should already be on login page when not authenticated
      cy.url().should('include', '/login');

      cy.get('input[name="email"]').type('invalid@example.com');
      cy.get('input[name="password"]').type('wrongpassword');

      cy.get('button[type="submit"]').click();

      // Should stay on login page - might show error or just stay due to invalid credentials
      cy.url().should('include', '/login');
    });
  });

  describe('Session Management', () => {
    it('should maintain session across page refreshes', () => {
      // Register and login user
      const userData = {
        name: 'Session Test User',
        email: `session-${Date.now()}@example.com`,
        password: 'sessiontest123'
      };

      cy.request('POST', `${Cypress.env('apiUrl')}/api/auth/register`, userData)
        .then((response) => {
          window.localStorage.setItem('token', response.body.token);
          window.localStorage.setItem('user', JSON.stringify(response.body.user));
        });

      cy.visit('/dashboard');
      cy.get('h1').should('contain', 'Welcome back');

      // Refresh page
      cy.reload();
      
      // Should still be logged in
      cy.get('h1').should('contain', 'Welcome back');
      cy.url().should('include', '/dashboard');
    });

    it('should redirect to login when not authenticated', () => {
      cy.visit('/dashboard');
      cy.url().should('include', '/login');
    });
  });
});