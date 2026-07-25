# Frontend E2E Test Suite

This directory contains the comprehensive end-to-end test suite for the Bonitah Financial Network frontend application using Playwright.

## Test Structure

```
tests/
├── e2e/
│   ├── auth/                    # Authentication flow tests
│   │   ├── wallet-connection.spec.ts
│   │   ├── siwe-authentication.spec.ts
│   │   └── session-management.spec.ts
│   ├── transactions/            # Transaction flow tests
│   │   ├── savings-deposit.spec.ts
│   │   ├── goal-creation.spec.ts
│   │   └── community-participation.spec.ts
│   ├── navigation/              # Navigation and routing tests
│   │   └── page-navigation.spec.ts
│   ├── error-handling/          # Error scenario tests
│   │   ├── network-failures.spec.ts
│   │   └── wallet-rejections.spec.ts
│   └── utils/                   # Test utilities and fixtures
│       ├── mock-wallet.ts       # Mock wallet implementation
│       ├── page-objects.ts      # Page object models
│       └── fixtures.ts          # Test fixtures and helpers
├── example.spec.ts              # Basic setup verification test
└── README.md                    # This file
```

## Test Coverage

### Authentication Tests (`auth/`)

**wallet-connection.spec.ts**

- Successful wallet connection from home and auth pages
- Connection state persistence across navigation
- Connection failure handling (user rejection, network errors)
- Network validation and switching prompts
- Cross-browser compatibility and responsive design

**siwe-authentication.spec.ts**

- Complete SIWE authentication flow
- JWT token storage and validation
- Session persistence across tabs and page refreshes
- Authentication failures (nonce generation, verification, timeouts)
- Security scenarios (replay attacks, signature validation)

**session-management.spec.ts**

- Session initialization from stored JWT tokens
- Cross-tab session synchronization
- Automatic logout on token expiry
- Auth guards and protected route access
- Session storage security

### Transaction Tests (`transactions/`)

**savings-deposit.spec.ts**

- Complete deposit transaction flow
- Amount validation (minimum/maximum limits)
- Transaction status tracking and confirmations
- Error handling (user rejection, contract failures, network errors)
- Balance updates and UI synchronization

**goal-creation.spec.ts**

- Goal creation with form validation
- Goal contribution transactions
- Progress tracking and calculations
- Goal completion and locking options
- Goal management (editing, deletion, history)

**community-participation.spec.ts**

- Joining and creating savings circles
- Contributing to investment pools
- Voting on governance proposals
- Community event registration
- Achievement system

### Navigation Tests (`navigation/`)

**page-navigation.spec.ts**

- Basic routing and URL handling
- Authenticated vs unauthenticated navigation
- Mobile menu functionality
- Browser navigation (back/forward, refresh)
- Navigation performance and caching
- Accessibility in navigation

### Error Handling Tests (`error-handling/`)

**network-failures.spec.ts**

- Complete network disconnection handling
- Intermittent connectivity issues
- API endpoint failures (500, 404, 401, 429)
- Recovery mechanisms and retry logic
- User communication and offline indicators

**wallet-rejections.spec.ts**

- Connection request rejections
- Transaction signing rejections
- Network switching rejections
- Wallet disconnection during operations
- Recovery guidance and user support

## Mock Wallet System

The test suite includes a sophisticated mock wallet system (`utils/mock-wallet.ts`) that provides:

- **Deterministic Testing**: Predictable wallet behavior for consistent test results
- **State Management**: Simulation of connection, disconnection, and network switching
- **Error Scenarios**: Controlled simulation of user rejections and failures
- **Event System**: Proper wallet event handling (accountsChanged, chainChanged)

### Predefined Configurations:

- `CONNECTED_BASE_SEPOLIA`: Standard connected wallet
- `DISCONNECTED`: Disconnected wallet state
- `WRONG_NETWORK`: Connected to incorrect network
- `REJECTS_CONNECTION`: Wallet that rejects connection requests
- `REJECTS_SIGNING`: Wallet that rejects transaction signing
- `REJECTS_NETWORK_SWITCH`: Wallet that rejects network switching

## Page Object Models

Tests use the Page Object pattern (`utils/page-objects.ts`) for maintainable, reusable test code:

- `HomePage`: Landing page interactions
- `AuthPage`: Authentication flow management
- `DashboardPage`: Dashboard content verification
- `SavingsPage`: Savings transaction flows
- `NavigationMenu`: Navigation component interactions
- `NetworkGuard`: Network validation handling

## Test Fixtures and Utilities

The `fixtures.ts` file provides:

- **Custom Test Extensions**: Enhanced Playwright test with BFN-specific fixtures
- **Authentication Helpers**: Quick setup of authenticated user sessions
- **Test Data**: Predefined transaction amounts, goal configurations
- **Browser State Management**: Clean state between tests

## Configuration

### Playwright Configuration (`playwright.config.ts`)

- **Multi-Browser Testing**: Chrome, Firefox, Safari, Mobile Chrome/Safari
- **Parallel Execution**: Optimized for CI/CD performance
- **Screenshot/Video**: Failure debugging with visual evidence
- **Base URL**: Configured for local development server
- **Timeouts**: Appropriate timeouts for various operations

### Environment Setup

The test suite supports multiple environments:

- **Development**: `http://localhost:3000` (default)
- **Staging**: Configurable via environment variables
- **CI/CD**: Optimized settings for automated testing

## Running Tests

### Prerequisites

```bash
# Install dependencies
pnpm install

# Install Playwright browsers
npx playwright install

# Install system dependencies (Linux)
sudo npx playwright install-deps
```

### Test Execution

```bash
# Run all e2e tests
pnpm test:e2e

# Run with UI for debugging
pnpm test:e2e:ui

# Run in headed mode (visible browser)
pnpm test:e2e:headed

# Run specific test file
npx playwright test tests/e2e/auth/wallet-connection.spec.ts

# Debug specific test
pnpm test:e2e:debug tests/e2e/auth/wallet-connection.spec.ts
```

### Test Reports

Playwright generates comprehensive HTML reports with:

- Test execution timeline
- Screenshots of failures
- Video recordings of failed tests
- Network activity logs
- Console output capture

## Best Practices

### Test Organization

- **Single Responsibility**: Each test file focuses on one feature area
- **Descriptive Names**: Clear test descriptions explaining the scenario
- **Proper Grouping**: Related tests grouped with `describe` blocks

### Error Handling

- **Graceful Degradation**: Tests verify app behavior under various failure conditions
- **User Experience**: Error messages and recovery options are validated
- **Edge Cases**: Comprehensive coverage of unusual but possible scenarios

### Performance

- **Parallel Execution**: Tests designed to run independently in parallel
- **Efficient Setup**: Minimal setup/teardown with smart state management
- **Resource Cleanup**: Proper cleanup to prevent test interference

### Accessibility

- **Keyboard Navigation**: Tests verify keyboard accessibility
- **Screen Reader Support**: ARIA labels and landmarks validation
- **Focus Management**: Proper focus handling during navigation

## CI/CD Integration

The test suite is designed for seamless CI/CD integration:

- **GitHub Actions**: Automated test execution on pull requests
- **Cross-Browser Matrix**: Tests run across multiple browser configurations
- **Failure Reporting**: Detailed reports with artifacts for debugging
- **Performance Monitoring**: Page load time tracking
- **Coverage Integration**: E2E coverage reporting

## Troubleshooting

### Common Issues

**Port Conflicts**

```bash
# Check if port 3000 is in use
lsof -i :3000
# Kill process if needed
kill -9 <PID>
```

**Browser Dependencies**

```bash
# Reinstall Playwright browsers
npx playwright install --force
```

**Mock Wallet Issues**

- Ensure mock wallet is properly injected before page navigation
- Check browser console for wallet-related errors
- Verify event listeners are properly set up

**Network Mocking**

- Route handlers must be set up before navigation
- Use proper await/async patterns for route handling
- Clear routes between tests if needed

### Debug Mode

For detailed debugging:

```bash
# Run with debug output
DEBUG=pw:api npx playwright test

# Run single test with debug
npx playwright test --debug tests/e2e/auth/wallet-connection.spec.ts
```

## Contributing

When adding new tests:

1. **Follow Naming Conventions**: Use descriptive file names ending in `.spec.ts`
2. **Use Existing Fixtures**: Leverage the mock wallet and page objects
3. **Add Error Scenarios**: Include both success and failure cases
4. **Document Complex Logic**: Add comments for complex test scenarios
5. **Update README**: Add new test files to the structure documentation

### Test Review Checklist

- [ ] Tests are independent and can run in any order
- [ ] Proper cleanup/reset between tests
- [ ] Both positive and negative scenarios covered
- [ ] Appropriate timeouts and waits used
- [ ] Mock data is realistic and consistent
- [ ] Error messages are user-friendly and actionable
- [ ] Accessibility considerations included
- [ ] Cross-browser compatibility verified
