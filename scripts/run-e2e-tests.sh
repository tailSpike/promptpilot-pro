#!/bin/bash

# E2E Test Runner for PromptPilot Pro
# This script runs end-to-end tests locally
#
# Usage:
#   ./scripts/run-e2e-tests.sh              # Run E2E tests
#   ./scripts/run-e2e-tests.sh --no-build   # Skip build steps
#   ./scripts/run-e2e-tests.sh --headless   # Run in headless mode (default)
#   ./scripts/run-e2e-tests.sh --headed     # Run with browser UI

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Parse command line arguments
SKIP_BUILD=false
HEADED=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --no-build)
      SKIP_BUILD=true
      shift
      ;;
    --headed)
      HEADED=true
      shift
      ;;
    --headless)
      HEADED=false
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--no-build] [--headed|--headless]"
      exit 1
      ;;
  esac
done

echo "🧪 Running E2E Tests for PromptPilot Pro"
echo "========================================"

# Function to check if port is in use
check_port() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti:$1 >/dev/null 2>&1
  elif command -v netstat >/dev/null 2>&1; then
    netstat -tuln | grep ":$1 " >/dev/null 2>&1
  else
    return 1
  fi
}

# Function to wait for service
wait_for_service() {
  local url=$1
  local name=$2
  local timeout=${3:-30}
  
  print_info "Waiting for $name to be ready..."
  if timeout ${timeout}s bash -c "until curl -f $url >/dev/null 2>&1; do sleep 2; done"; then
    print_status "$name is ready"
    return 0
  else
    print_error "$name failed to start within ${timeout}s"
    return 1
  fi
}

# Cleanup function
cleanup() {
  print_info "Cleaning up..."
  if [ ! -z "$BACKEND_PID" ]; then
    kill $BACKEND_PID 2>/dev/null || true
  fi
  if [ ! -z "$FRONTEND_PID" ]; then
    kill $FRONTEND_PID 2>/dev/null || true
  fi
  
  # Kill any processes using our ports
  if check_port 5000; then
    print_info "Killing process on port 5000..."
    kill $(lsof -ti:5000) 2>/dev/null || true
  fi
  if check_port 4173; then
    print_info "Killing process on port 4173..."
    kill $(lsof -ti:4173) 2>/dev/null || true
  fi
}

# Set up cleanup trap
trap cleanup EXIT

# Check for required directories
if [ ! -d "backend" ] || [ ! -f "backend/package.json" ]; then
  print_error "Backend directory not found or invalid"
  exit 1
fi

if [ ! -d "frontend" ] || [ ! -f "frontend/package.json" ]; then
  print_error "Frontend directory not found or invalid"
  exit 1
fi

# Set up environment variables
export DATABASE_URL='file:./test.db'
export JWT_SECRET='test-jwt-secret-key-for-e2e'
export NODE_ENV='test'
export PORT='5000'
export API_URL='http://localhost:5000'

print_info "Environment configured for E2E testing"

# Install dependencies if needed
print_status "Checking dependencies..."
if [ ! -d "backend/node_modules" ]; then
  print_info "Installing backend dependencies..."
  cd backend && npm ci && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
  print_info "Installing frontend dependencies..."
  cd frontend && npm ci && cd ..
fi

# Setup test database
print_status "Setting up test database..."
cd backend
if ! npx prisma generate --silent; then
  print_error "Failed to generate Prisma client"
  exit 1
fi

if ! npx prisma db push --force-reset --silent; then
  print_error "Failed to reset test database"
  exit 1
fi
cd ..

# Build applications if needed
if [ "$SKIP_BUILD" = false ]; then
  print_status "Building applications..."
  
  if [ ! -d "backend/dist" ]; then
    print_info "Building backend..."
    cd backend && npm run build --silent && cd ..
  fi
  
  if [ ! -d "frontend/dist" ]; then
    print_info "Building frontend..."
    cd frontend && npm run build --silent && cd ..
  fi
else
  print_info "Skipping build steps"
fi

# Start backend server
print_status "Starting backend server..."
cd backend
PORT=5000 npm start &
BACKEND_PID=$!
cd ..

# Wait for backend
if ! wait_for_service "http://localhost:5000/api/health" "Backend server" 30; then
  print_error "Backend server failed to start"
  exit 1
fi

# Start frontend server
print_status "Starting frontend server..."
cd frontend
npm run preview &
FRONTEND_PID=$!
cd ..

# Wait for frontend
if ! wait_for_service "http://localhost:4173" "Frontend server" 30; then
  print_error "Frontend server failed to start"
  exit 1
fi

# Run Cypress E2E tests
print_status "Running Cypress E2E tests..."
cd frontend

CYPRESS_OPTS="--config baseUrl=http://localhost:4173,env.apiUrl=http://localhost:5000"
if [ "$HEADED" = true ]; then
  CYPRESS_OPTS="$CYPRESS_OPTS --browser chrome"
else
  CYPRESS_OPTS="$CYPRESS_OPTS --headless --browser chrome"
fi

if npx cypress run $CYPRESS_OPTS; then
  print_status "🎉 All E2E tests passed!"
  echo ""
  echo "✅ E2E test suite completed successfully"
else
  print_error "❌ E2E tests failed!"
  echo ""
  echo "💡 Troubleshooting tips:"
  echo "  • Check Cypress screenshots: frontend/cypress/screenshots/"
  echo "  • Check Cypress videos: frontend/cypress/videos/"
  echo "  • Run with --headed to see browser interactions"
  echo "  • Check backend logs for API errors"
  exit 1
fi

cd ..

print_status "E2E test run completed successfully!"