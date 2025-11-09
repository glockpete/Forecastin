# Forecastin Frontend

> Modern, performant React application for geopolitical intelligence visualization

This is the frontend application for Forecastin, built with React, TypeScript, and a focus on performance, developer experience, and production-grade error handling.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test

# Run linter
npm run lint
npm run lint:fix
```

The application will be available at `http://localhost:3000`.

---

## 🏗️ Architecture

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **UI Framework** | React 18.2 | Component-based UI with concurrent features |
| **Language** | TypeScript 5.3 (Strict Mode) | Type safety and developer experience |
| **State Management** | Zustand + React Query | Hybrid state (local + server) |
| **Styling** | Tailwind CSS 3.3 | Utility-first CSS framework with dark theme |
| **Mapping** | deck.gl 9.2 + MapLibre GL | GPU-accelerated geospatial visualization |
| **Build Tool** | Vite 5.4 | Fast development and optimized builds |
| **Testing** | Vitest 4.0 | Fast unit and integration testing |
| **Linting** | ESLint + TypeScript ESLint | Code quality and consistency |

### Key Features

- **🌙 Dark Theme First**: Consistent dark theme across all components
- **📊 GPU-Accelerated Rendering**: deck.gl for high-performance geospatial layers
- **⚡ Real-Time Updates**: WebSocket integration for live data
- **🔒 Type Safety**: 100% TypeScript strict mode compliance
- **🎯 Error Boundaries**: Graceful error handling in production
- **📝 Structured Logging**: Environment-aware logging utility
- **🧪 Comprehensive Testing**: Unit, integration, and E2E test coverage

---

## 📝 Logging System

The frontend uses a **structured logging utility** that replaces raw `console.*` calls throughout the codebase.

### Logger API

```typescript
import { logger } from '@/lib/logger';

// Log levels (filtered by NODE_ENV)
logger.debug('Debug message', { context: 'optional' });  // Development only
logger.info('Info message', { userId: 123 });           // Development only
logger.warn('Warning message', { reason: 'timeout' });   // Always logged
logger.error('Error message', { error: err });          // Always logged

// Grouped logging
logger.group('Group Name');
logger.debug('Message in group');
logger.groupEnd();
```

### Environment-Based Filtering

| Environment | Logged Levels |
|-------------|---------------|
| `development` | debug, info, warn, error |
| `production` | warn, error only |
| `test` | warn, error only |

### Benefits

- **🚫 Zero Console Noise in Production**: Only warnings and errors are logged
- **🔍 Detailed Debugging in Development**: Full visibility during development
- **📦 Consistent Format**: Structured logging with context objects
- **🛡️ ESLint Enforcement**: `no-console` rule prevents raw console usage

### Migration from console.*

The entire codebase has been migrated from raw `console.*` calls to the logger:

```typescript
// ❌ Old (85+ instances replaced)
console.log('User logged in');
console.debug('State updated:', state);
console.warn('Connection timeout');
console.error('API error:', error);

// ✅ New
logger.debug('User logged in');
logger.debug('State updated', { state });
logger.warn('Connection timeout');
logger.error('API error', { error });
```

**85+ console.* calls replaced** across 11 files, ensuring clean production logs.

---

## 🛡️ Error Boundaries

The application uses React Error Boundaries to catch and handle errors gracefully.

### Implementation

```typescript
// Root level (index.tsx)
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

### Features

- **Development Mode**: Shows detailed error information with stack traces
- **Production Mode**: Shows user-friendly error message with refresh option
- **Error Logging**: Automatically logs errors to structured logger
- **Graceful Degradation**: Prevents entire app crashes

### Usage in Components

```typescript
import { ErrorBoundary } from '@/components/ErrorBoundary';

function FeatureSection() {
  return (
    <ErrorBoundary>
      <ComplexFeature />
    </ErrorBoundary>
  );
}
```

### Error Recovery

The ErrorBoundary component provides:
- **Reset functionality**: Users can attempt to recover without page refresh
- **Detailed error info in dev**: Full stack traces for debugging
- **User-friendly messages in prod**: "Something went wrong" message
- **Automatic error reporting**: Errors logged to logger for monitoring

---

## 🌙 Dark Theme

The application enforces a **consistent dark theme** across all components.

### Configuration

**Tailwind Config** (`tailwind.config.js`):
```javascript
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'hsl(222.2, 84%, 4.9%)',  // Dark blue-black
        surface: 'hsl(217.2, 32.6%, 17.5%)',  // Dark gray-blue
        // ... additional dark theme colors
      }
    }
  }
}
```

**Global Styles** (`index.css`):
```css
body {
  background-color: hsl(222.2, 84%, 4.9%);
  color: hsl(210, 40%, 98%);
}
```

### Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `hsl(222.2, 84%, 4.9%)` | Page background |
| `surface` | `hsl(217.2, 32.6%, 17.5%)` | Card and panel backgrounds |
| `primary` | `hsl(217.2, 91.2%, 59.8%)` | Primary actions |
| `text` | `hsl(210, 40%, 98%)` | Primary text |
| `muted` | `hsl(215, 20.2%, 65.1%)` | Secondary text |

---

## 🧪 Testing

### Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

### Test Structure

```
tests/
├── unit/           # Unit tests for utilities and hooks
├── integration/    # Integration tests for features
└── e2e/            # End-to-end tests
```

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('Component', () => {
  it('should render correctly', () => {
    render(<Component />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

---

## 🔧 Development

### Project Structure

```
frontend/
├── src/
│   ├── components/        # Reusable UI components
│   │   └── ErrorBoundary.tsx
│   ├── config/           # Configuration files
│   │   ├── env.ts        # Environment variables
│   │   └── feature-flags.ts
│   ├── handlers/         # Event handlers
│   │   ├── realtimeHandlers.ts
│   │   └── validatedHandlers.ts
│   ├── hooks/            # Custom React hooks
│   │   └── useHybridState.ts
│   ├── integrations/     # External integrations
│   │   └── LayerWebSocketIntegration.ts
│   ├── lib/              # Shared utilities
│   │   └── logger.ts     # Structured logging
│   ├── utils/            # Helper functions
│   │   ├── stateManager.ts
│   │   ├── errorRecovery.ts
│   │   └── idempotencyGuard.ts
│   ├── errors/           # Error definitions
│   │   └── errorCatalog.ts
│   └── index.tsx         # Application entry point
├── tests/                # Test files
├── public/               # Static assets
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── vite.config.ts        # Vite configuration
└── tailwind.config.js    # Tailwind CSS configuration
```

### Code Style

The project enforces strict code quality standards:

- **TypeScript Strict Mode**: All files must pass `--strict` checks
- **ESLint Rules**: Comprehensive linting including:
  - `no-console`: Enforced (use `logger` instead)
  - React hooks rules
  - TypeScript recommended rules
- **Prettier**: Automatic code formatting

### Development Workflow

1. **Start development server**: `npm start`
2. **Make changes**: Edit files in `src/`
3. **Check types**: `npm run typecheck`
4. **Run linter**: `npm run lint`
5. **Run tests**: `npm test`
6. **Fix issues**: `npm run lint:fix`

### Environment Variables

Create a `.env` file in the frontend directory:

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:9000
VITE_WS_URL=ws://localhost:9000/ws

# Feature Flags
VITE_FF_USE_MOCKS=false
VITE_FF_DEBUG_MODE=false

# Environment
NODE_ENV=development
```

See `.env.example` for all available options.

---

## 🚢 Building for Production

### Build Process

```bash
# Type check
npm run typecheck

# Lint code
npm run lint

# Run tests
npm test

# Build production bundle
npm run build

# Preview production build
npm run preview
```

### Build Output

```
dist/
├── assets/          # JavaScript, CSS, and asset bundles
├── index.html       # Main HTML file
└── ...              # Other static assets
```

### Performance Optimizations

- **Code Splitting**: Automatic route-based splitting
- **Tree Shaking**: Unused code elimination
- **Minification**: Optimized JavaScript and CSS
- **Compression**: Gzip and Brotli support
- **Cache Headers**: Long-term caching for static assets

---

## 📦 Key Dependencies

### Core Libraries

- **react** (18.2): UI framework
- **typescript** (5.3): Type safety
- **vite** (5.4): Build tool and dev server

### State Management

- **zustand** (4.4): Lightweight state management
- **@tanstack/react-query** (5.90): Server state management

### Visualization

- **deck.gl** (9.2): GPU-accelerated geospatial rendering
- **maplibre-gl** (4.7): Map rendering
- **react-map-gl** (7.1): React wrapper for MapLibre

### UI Components

- **tailwindcss** (3.3): Utility-first CSS
- **lucide-react** (0.292): Icon library
- **react-hot-toast** (2.6): Toast notifications

### Utilities

- **zod** (3.22): Runtime type validation
- **clsx** (2.0): Conditional class names
- **h3-js** (4.1): Hexagonal hierarchical geospatial indexing

---

## 🔍 Code Quality

### ESLint Configuration

```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "no-console": ["error", { "allow": [] }],
    "react/react-in-jsx-scope": "off"
  }
}
```

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

---

## 🐛 Debugging

### Development Tools

- **React DevTools**: Inspect component tree and props
- **React Query DevTools**: Monitor server state and cache
- **Redux DevTools**: Zustand store inspection (via middleware)
- **Vite DevTools**: Performance and build analysis

### Common Issues

#### WebSocket Connection Failures

```bash
# Check WebSocket URL
console.log(import.meta.env.VITE_WS_URL);

# Test WebSocket connection
wscat -c ws://localhost:9000/ws
```

#### Build Errors

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf node_modules/.vite
```

#### Type Errors

```bash
# Run type checker
npm run typecheck

# Check specific file
npx tsc --noEmit src/path/to/file.tsx
```

---

## 📚 Additional Resources

### Internal Documentation

- [DEVELOPER_SETUP.md](../docs/DEVELOPER_SETUP.md) - Complete development setup
- [GOLDEN_SOURCE.md](../docs/GOLDEN_SOURCE.md) - Core requirements and specifications
- [TESTING_GUIDE.md](../docs/TESTING_GUIDE.md) - Testing best practices

### External Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [deck.gl Documentation](https://deck.gl/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)

---

## 🤝 Contributing

### Development Guidelines

1. **Write TypeScript**: All new files must be `.ts` or `.tsx`
2. **Use the logger**: Never use `console.*` directly
3. **Add error boundaries**: Wrap risky components
4. **Write tests**: Maintain test coverage
5. **Follow conventions**: Use existing patterns

### Code Review Checklist

- [ ] TypeScript strict mode passes
- [ ] ESLint passes with no warnings
- [ ] Tests added/updated and passing
- [ ] No `console.*` calls (use `logger`)
- [ ] Error boundaries added where appropriate
- [ ] Documentation updated if needed

---

## 📄 License

*License information coming soon as part of open source launch.*

---

**Built with ❤️ by the Forecastin team**
