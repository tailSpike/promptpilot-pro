# PromptPilot Pro - Testing & CI/CD Documentation

## 🎯 Overview

This document outlines the comprehensive testing strategy and CI/CD pipeline implemented for PromptPilot Pro, ensuring high code quality and automated deployment processes.

## 📊 Test Coverage Status

### ✅ Completed Tests
- **Version Control Tests**: 27/27 tests passing (100% success rate)
- **Enhanced Workflow Trigger Tests**: Comprehensive UI testing with full authentication flow
- **Comprehensive Workflow Management Tests**: Full CRUD operations, step management, execution testing
- **Workflow Preview Tests**: Sample data toggles, manual payload validation, warning handling, and end-to-end preview UX flows

### 🧪 E2E Test Suites

### 🔁 Retry Strategy for Flake Reduction
- Cypress global retries are enabled via `retries.runMode = 2` and `retries.openMode = 1`.
- This configuration leverages the official [Test Retries guide](https://docs.cypress.io/app/guides/test-retries#Introduction) to automatically re-run flaky specs in CI while keeping local debugging snappy.
- Each retry re-executes `beforeEach`/`afterEach` hooks, so tests remain isolated across attempts.


#### 1. Version Control Tests (`version-control.cy.ts`)
- ✅ Authentication flow testing
- ✅ Repository creation and management
- ✅ Branch operations (create, switch, merge)
- ✅ Commit management with proper scoping
- ✅ Error handling and edge cases

#### 2. Enhanced Workflow Triggers (`enhanced-workflow-triggers.cy.ts`)
- ✅ Complete UI interaction testing
- ✅ All 5 trigger types (MANUAL, SCHEDULED, WEBHOOK, API, EVENT)
- ✅ Form validation and error handling
- ✅ Responsive design testing
- ✅ Real-time updates and feedback

#### 3. Comprehensive Workflow Management (`workflow-management.cy.ts`)
- ✅ Workflow CRUD operations
- ✅ Step management (all 6 step types: PROMPT, CONDITION, TRANSFORM, DELAY, WEBHOOK, DECISION)
- ✅ Variable mapping and data flow
- ✅ Workflow execution and monitoring
- ✅ Integration with prompts system
- ✅ Error handling and validation
- ✅ Real-time updates and performance testing

#### 4. Workflow Preview (`workflow-preview.cy.ts`)
- ✅ Toggle between manual JSON payloads and auto-generated sample data
- ✅ Validate malformed payloads and surface actionable error messaging
- ✅ Confirm preview results render step-by-step breakdowns with warnings and token estimates
- ✅ Ensure clearing previews resets UI state without stale data
- ✅ Smoke test preview failure states (backend validation errors)

## 🚀 CI/CD Pipeline

### GitHub Actions Workflow (`.github/workflows/ci.yml`)

#### Jobs Structure:
1. **Backend CI** - Node.js 18.x & 20.x matrix
   - Dependency installation
   - Database setup (Prisma)
   - Linting
   - Unit & Integration tests
   - Build verification

2. **Frontend CI** - Node.js 18.x & 20.x matrix
   - Dependency installation
   - Linting
   - Build verification

3. **Security Audits** - Backend & Frontend
   - NPM audit for high-severity vulnerabilities
   - Dependency security checks

4. **E2E Tests** - Comprehensive end-to-end testing
   - Backend & Frontend setup
   - Database initialization
   - Server startup with health checks
   - Cypress test execution
   - Artifact collection (screenshots, videos)
   - Automated cleanup

5. **Quality Gate** - Final validation
   - All job status verification
   - Fail-fast on any job failure
   - Comprehensive status reporting

### Pipeline Features:
- ✅ Multi-node version testing (18.x, 20.x)
- ✅ Automatic database setup and migration
- ✅ Health check verification before tests
- ✅ Artifact collection for debugging
- ✅ Comprehensive error handling
- ✅ Fail-fast quality gates

## 🪝 Git Hooks Implementation

### Pre-commit Hook (`.git/hooks/pre-commit`)
- ✅ Backend & Frontend linting
- ✅ Quick unit tests
- ✅ TypeScript compilation checks
- ✅ Code quality checks (console.log detection, TODO/FIXME warnings)
- ✅ Large file detection
- ✅ Cross-platform compatibility

### Pre-push Hook (`.git/hooks/pre-push`)
- ✅ Comprehensive backend tests (unit + integration)
- ✅ Frontend build verification
- ✅ Cypress TypeScript compilation
- ✅ Protected branch validation
- ✅ Security checks (sensitive data detection)
- ✅ Hard-coded URL detection

### Setup Scripts:
- ✅ **Bash script** (`scripts/setup-hooks.sh`) - Unix/Linux/MacOS
- ✅ **PowerShell script** (`scripts/setup-hooks.ps1`) - Windows
- ✅ **NPM integration** - `npm run setup:hooks`

## 📦 Package.json Scripts

### Root Level Coordination (`package.json`)
```json
{
  "scripts": {
    "setup": "npm run install:all && npm run db:setup && npm run setup:hooks",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:e2e",
    "ci": "npm run lint && npm run build && npm run test:all",
    "precommit": "npm run lint && npm run test:unit",
    "prepush": "npm run lint && npm run test"
  }
}
```

### Key Features:
- ✅ Workspace coordination
- ✅ Parallel execution support
- ✅ Environment setup automation
- ✅ Cross-platform compatibility

## 🛠 Development Workflow

### 1. Initial Setup
```bash
# Clone repository
git clone <repository-url>
cd promptpilot-pro

# Install dependencies and setup hooks
npm run setup
```

### 2. Development Process
```bash
# Start development servers
npm run dev

# Run tests during development
npm run test:unit          # Quick unit tests
npm run test:integration   # Integration tests
npm run test:e2e          # End-to-end tests
npm run test:all          # All tests

# Linting and formatting
npm run lint              # Check all code
npm run lint:fix          # Fix auto-fixable issues
```

### 3. Pre-commit Process (Automated)
When you run `git commit`, the pre-commit hook will automatically:
1. Run linting on all changed files
2. Execute unit tests
3. Check TypeScript compilation
4. Validate code quality
5. Block commit if any checks fail

### 4. Pre-push Process (Automated)
When you run `git push`, the pre-push hook will automatically:
1. Run comprehensive test suite
2. Validate builds
3. Check for sensitive data
4. Verify protected branch rules
5. Block push if any checks fail

## 🎯 Quality Metrics

### Test Coverage Goals:
- **Unit Tests**: >80% code coverage
- **Integration Tests**: Critical path coverage
- **E2E Tests**: User journey coverage
- **Security Tests**: Vulnerability scanning

### Performance Metrics:
- **CI Pipeline**: <10 minutes total execution
- **E2E Tests**: <5 minutes execution time
- **Pre-commit Hooks**: <30 seconds execution
- **Pre-push Hooks**: <2 minutes execution

## 🚨 Troubleshooting

### Common Issues:

1. **Hook Permissions (Unix/Linux/MacOS)**
   ```bash
   chmod +x .git/hooks/pre-commit
   chmod +x .git/hooks/pre-push
   ```

2. **Windows PowerShell Execution Policy**
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

3. **Skip Hooks Temporarily**
   ```bash
   git commit --no-verify
   git push --no-verify
   ```

4. **Cypress Issues**
   ```bash
   # Clear cache and reinstall
   npx cypress cache clear
   npm run install:frontend
   ```

### Debug Information:
- Check `.github/workflows/ci.yml` for CI configuration
- Review `cypress/` directory for test configurations
- Examine `scripts/` directory for setup scripts
- Check individual `package.json` files for available scripts

## 📋 Next Steps

### Potential Enhancements:
- [ ] Add visual regression testing
- [ ] Implement performance testing
- [ ] Add accessibility testing
- [ ] Integrate code coverage reporting
- [ ] Add automated dependency updates
- [ ] Implement staged rollouts
- [ ] Add monitoring and alerting

## 🎉 Conclusion

The PromptPilot Pro project now has a comprehensive testing and CI/CD infrastructure that ensures:

- **High Code Quality** through automated linting and testing
- **Reliable Deployments** through comprehensive CI/CD pipeline
- **Developer Productivity** through automated workflows and quick feedback
- **Security** through automated vulnerability scanning and sensitive data detection
- **Maintainability** through comprehensive documentation and standardized processes

The testing infrastructure provides confidence in code changes and ensures that the application remains stable and secure as it evolves.