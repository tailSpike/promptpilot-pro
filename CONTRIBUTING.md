# Contributing to PromptPilot Pro

Thank you for your interest in contributing to PromptPilot Pro! We welcome contributions from the community.

## Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/promptpilot-pro.git`
3. Navigate to project: `cd promptpilot-pro`
4. **Quick Start**: Run `.\start.ps1` (Windows) or `./scripts/start.sh` (Linux/macOS)
5. Create a feature branch: `git checkout -b feature/your-feature-name`

### Manual Setup (if needed)
```bash
# Install all dependencies
npm run install:all

# Setup database
cd backend && npx prisma generate && npx prisma db push

# Install git hooks
npm run setup:hooks
```

## Development Guidelines

### Code Style
- Use TypeScript for all new code
- Follow the existing code style and formatting
- Run `npm run lint` to check for style issues
- Run `npm run format` to auto-format code

### Testing Requirements
- **Write comprehensive tests** for new features (unit + integration + E2E)
- **Backend**: Run `npm run test:all` (must pass all 66+ tests)
- **Frontend**: Run `npm run test` + `npm run e2e` (79 E2E tests)
- **Full Suite**: Run `npm run test:all` from root to test entire project
- **Coverage**: Maintain or improve existing test coverage
- **CI Validation**: All tests must pass in GitHub Actions pipeline

### Commit Messages
- Use conventional commits format: `type(scope): description`
- Examples:
  - `feat(api): add user authentication endpoint`
  - `fix(ui): resolve navigation menu overlap`
  - `docs(readme): update installation instructions`

## Pull Request Process

1. **Pre-flight Checks**:
   - Run `npm run lint` (backend + frontend)
   - Run `npm run test:all` (145+ tests must pass)
   - Check `.\status.ps1` to ensure services are working
   
2. **Documentation Updates**:
   - Update README.md if adding new features
   - Update API documentation in `docs/API.md` for new endpoints
   - Add examples to relevant components if UI changes

3. **Pull Request Creation**:
   - Create PR with clear, descriptive title
   - Use conventional commit format in title
   - Include detailed description of changes
   - Link any related issues with `Fixes #issue-number`
   - Add screenshots for UI changes

4. **CI/CD Validation**:
   - GitHub Actions must pass (all jobs green)
   - Monitor with `gh run list` and `gh run view <run-id>`
   - Address any CI failures promptly

5. **Code Review**:
   - Wait for maintainer review
   - Address feedback constructively  
   - Keep commits focused and atomic

## Reporting Issues

- Use the issue templates provided
- Include detailed reproduction steps
- Provide environment information
- Add relevant labels

## Questions?

Feel free to open a discussion or reach out to the maintainers.

## Code of Conduct

Please be respectful and inclusive in all interactions. We want to maintain a welcoming community for everyone.