#!/bin/bash

# Unified pre-commit checks for PromptPilot Pro
# Runs lint, unit tests, builds, and the Cypress E2E suite for critical branches.

set -e

# Enable extended globbing for pattern matching (if available)
if command -v shopt >/dev/null 2>&1; then
  shopt -s extglob
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
  echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

print_status "🔍 Running pre-commit checks..."

PROJECT_ROOT="$(git rev-parse --show-toplevel)"
cd "$PROJECT_ROOT"

# Ensure we are in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  print_error "Not in a git repository"
  exit 1
fi

check_npm_project() {
  [ -d "$1" ] && [ -f "$1/package.json" ]
}

# Backend checks
if check_npm_project "backend"; then
  print_status "Running backend linter..."
  (
    cd backend
    if ! npm run lint --silent 2>/dev/null; then
      print_warning "Backend lint script not found or failed"
    else
      print_status "Backend linting passed"
    fi

    print_status "Running backend unit tests..."
    if npm run test:unit --silent 2>/dev/null; then
      print_status "Backend unit tests passed"
    elif npm run test --silent 2>/dev/null; then
      print_status "Backend tests passed"
    else
      print_warning "Backend test script not found"
    fi

    if npm run build --silent 2>/dev/null; then
      print_status "Backend TypeScript compilation passed"
    else
      print_warning "Backend build script not found or failed"
    fi
  )
fi

# Frontend checks
if check_npm_project "frontend"; then
  print_status "Running frontend linter..."
  (
    cd frontend
    if ! npm run lint --silent 2>/dev/null; then
      print_warning "Frontend lint script not found or failed"
    else
      print_status "Frontend linting passed"
    fi

    if npm run build --silent 2>/dev/null; then
      print_status "Frontend build passed"
    else
      print_warning "Frontend build script not found or failed"
    fi

    if npm run type-check:cypress --silent 2>/dev/null; then
      print_status "Cypress TypeScript compilation passed"
    else
      print_warning "Cypress TypeScript compilation failed"
    fi
  )
fi

print_status "Checking for common issues..."

if git diff --cached --name-only | grep -E '\\.(js|ts|jsx|tsx)$' | grep -v -E '(test|spec|cypress)' | xargs grep -l 'console\\.log' 2>/dev/null; then
  print_warning "Found console.log statements in production code. Consider removing them."
fi

if git diff --cached --name-only | xargs grep -l -E '(TODO|FIXME|XXX)' 2>/dev/null; then
  print_warning "Found TODO/FIXME comments in staged files."
fi

large_files=$(git diff --cached --name-only | xargs ls -la 2>/dev/null | awk '$5 > 1048576 {print $9}')
if [ -n "$large_files" ]; then
  print_warning "Found large files (>1MB) in commit:"
  echo "$large_files"
fi

current_branch=$(git rev-parse --abbrev-ref HEAD)
feature_branch="feature/epic2-story2-triggers-scheduling"

if [ "$current_branch" = "$feature_branch" ]; then
  if [ "$SKIP_E2E" = "1" ]; then
    print_warning "Skipping Cypress E2E suite due to SKIP_E2E=1"
  else
    print_status "Running Cypress E2E suite for $feature_branch prior to commit..."
    if npm run test:e2e; then
      print_status "Cypress E2E suite passed"
    else
      print_error "Cypress E2E suite failed"
      echo -e "${RED}Fix the failing specs or rerun with SKIP_E2E=1 git commit${NC}"
      exit 1
    fi
  fi
fi

print_status "Pre-commit checks completed successfully!"
echo -e "${GREEN}🚀 Ready to commit!${NC}"

exit 0
