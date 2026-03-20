# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Running the Application
```bash
# Start development server with hot reload
npm run dev

# Debug mode with inspector
npm run devdebug

# Production mode
npm run start:prod
```

### Testing
```bash
# Run all tests
npm run test

# Run specific test file
jest -- <name-of-file>

# Run tests with coverage
npm run test:coverage

# Watch mode for tests
npm run test:watch
```

### Database Operations
```bash
# Run migrations
npm run migrate:up

# Create new migration
npm run migrate:create <migration-name>

# Reset database (caution: drops all data)
npm run migrate:reset

# Roll back migrations
npm run migrate:down
```

### Code Quality
```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format:fix

# TypeScript build
npm run build

# Clean build and rebuild
npm run build:clean
```

### Docker Commands
```bash
# Start all services (postgres, etc.)
make up

# Stop all services
make down

# Reset everything (removes all docker data)
make reset

# View logs
make logs
```

### Committing Code
```bash
# Stage changes
git add .

# Use commitizen for conventional commits
npm run commit
```

## High-Level Architecture

### Project Structure
The codebase follows a modular Express.js architecture with TypeScript:

- **Entry Points**: `src/index.ts` initializes the server, database connections, Redis, Kafka, and workers. `src/app.ts` configures Express middleware and routes.

- **API Layer**: REST endpoints are organized under `src/api/v1/modules/` with each module containing its own routes, controllers, and business logic.

- **Database**: Uses Knex.js as query builder with PostgreSQL. Models are in `src/models/`. Database migrations are in `db/migrations/`.

- **Background Processing**: 
  - Bull queues for job processing (`src/workers/`)
  - Kafka for event streaming (`src/messaging/kafka/`)
  - Cron jobs for scheduled tasks (`src/cron/jobs/`)

- **External Integrations**: The service integrates with numerous third-party APIs including AWS services (S3, SES, Athena, Redshift), Plaid, QuickBooks (via Intuit OAuth), Google APIs, OpenAI, and various business verification services.

- **Authentication**: Uses AWS Cognito for authentication with JWT verification.

### Key Design Patterns

- **Path Aliases**: TypeScript path aliases are configured (e.g., `#api`, `#common`, `#helpers`) for cleaner imports.

- **Middleware Pattern**: Custom middleware for error handling, authentication, and request logging.

- **Service Layer**: Business logic is separated from controllers in service files within each module.

- **Configuration**: Environment-based configuration using dotenv with `.env` files.

- **Logging**: Pino logger with rotating file support for structured logging.

- **Feature Flags**: LaunchDarkly integration for feature toggles.

### Testing Strategy
- Jest with TypeScript support
- Mock database client using knex-mock-client
- Test files follow `*.test.ts` pattern
- Coverage thresholds configured in jest.config.js

### Development Workflow
1. Local development uses Docker for PostgreSQL
2. Environment variables in `.env.local` for local development
3. Nodemon watches for file changes in development mode
4. TypeScript compilation required for production builds