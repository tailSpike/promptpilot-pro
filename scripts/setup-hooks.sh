#!/bin/bash

# Setup Git hooks for PromptPilot Pro
# This script installs pre-commit and pre-push hooks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
  echo -e "${GREEN}✓${NC} $1"
}

print_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

# Change to project root
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

print_info "Setting up Git hooks for PromptPilot Pro..."

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  print_error "Not in a git repository. Please run 'git init' first."
  exit 1
fi

HOOKS_DIR=".git/hooks"

# Make sure hooks directory exists
mkdir -p "$HOOKS_DIR"

# Function to install a hook
install_hook() {
  local hook_name=$1
  local hook_source="$HOOKS_DIR/$hook_name"
  
  if [ -f "$hook_source" ]; then
    print_status "Installing $hook_name hook..."
    
    # Make executable (works on Unix-like systems)
    if command -v chmod > /dev/null 2>&1; then
      chmod +x "$hook_source"
      print_status "$hook_name hook is now executable"
    else
      print_warning "$hook_name hook installed but may need manual permission setup on Windows"
    fi
  else
    print_error "$hook_name hook source not found at $hook_source"
    return 1
  fi
}

# Install pre-commit hook
if install_hook "pre-commit"; then
  print_status "Pre-commit hook installed successfully"
else
  print_error "Failed to install pre-commit hook"
  exit 1
fi

# Install pre-push hook
if install_hook "pre-push"; then
  print_status "Pre-push hook installed successfully"
else
  print_error "Failed to install pre-push hook"
  exit 1
fi

# Test the installation
print_info "Testing hook installation..."

# Check if hooks are executable
if [ -x "$HOOKS_DIR/pre-commit" ]; then
  print_status "Pre-commit hook is executable"
else
  print_warning "Pre-commit hook may not be executable"
fi

if [ -x "$HOOKS_DIR/pre-push" ]; then
  print_status "Pre-push hook is executable"
else
  print_warning "Pre-push hook may not be executable"
fi

print_status "Git hooks setup completed!"
echo ""
print_info "The following hooks are now active:"
echo "  • pre-commit: Runs linting and quick tests before each commit"
echo "  • pre-push: Runs comprehensive tests before pushing to remote"
echo ""
print_info "To skip hooks temporarily, use:"
echo "  • git commit --no-verify"
echo "  • git push --no-verify"
echo ""
print_status "Happy coding! 🚀"