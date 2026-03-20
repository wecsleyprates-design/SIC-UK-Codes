# Datapooler - WorthAI Warehouse Service

A comprehensive data warehouse service that manages business matching, firmographic data enrichment, and integration with multiple data sources including Equifax, NPI, ZoomInfo, and other business intelligence platforms.

## Overview

Datapooler is a microservice that provides:
- **Entity Matching**: ML-powered business entity matching across multiple data sources
- **Firmographic Data Enrichment**: Enrichment of business profiles with demographic and firmographic data
- **Data Warehouse Management**: PostgreSQL/Redshift data warehouse operations
- **Asynchronous Task Processing**: Celery-based background job processing
- **REST API**: FastAPI-based web service for data operations
- **Real-time Messaging**: Kafka integration for event streaming

## Features

### Core Services

- **Business Matching Service**: ML-based similarity matching using XGBoost for entity resolution
- **Firmographics Service**: Business data enrichment with demographic and industry information
- **NPI Integration**: Healthcare provider data integration and matching
- **Export Service**: Customer file export and data extraction
- **Facts Service**: Fact table management and aggregation
- **Extra Verification Service**: Additional verification workflows
- **Score Audit Service**: WorthAI score auditing and tracking
- **Zipcode Service**: Geographic data management

### Background Tasks

- Generate firmographic data enrichments
- Generate entity matches across data sources
- Incremental NPI updates
- Customer file exports
- WorthAI score audits

### API Endpoints

- Health checks and monitoring
- Business matching endpoints
- NPI data lookup
- Export management
- Facts data operations
- Queue/messaging operations
- Zipcode lookups

## Technology Stack

- **Python**: 3.12+
- **Web Framework**: FastAPI with Hypercorn
- **Task Queue**: Celery with Redis
- **Databases**:
  - PostgreSQL (operational data)
  - AWS Redshift (data warehouse)
- **Messaging**: Kafka for event streaming
- **ML**: XGBoost, scikit-learn for similarity matching
- **Data Processing**: Polars, pandas
- **ORM**: SQLAlchemy with Alembic migrations
- **Cloud**: AWS (S3, SES, Cognito)
- **Observability**: Datadog APM, structured JSON logging

## Project Structure

```
datapooler/
├── adapters/          # External service adapters
│   ├── api/          # API clients
│   ├── aws/          # AWS service integrations
│   ├── db/           # Database models and connections
│   ├── files/        # File handling
│   ├── messages/     # Kafka messaging
│   ├── queues/       # Queue adapters
│   └── redshift/     # Redshift-specific operations
├── cli/              # Command-line interface
├── models/           # Data models
│   ├── businesses.py
│   ├── equifax.py
│   ├── fact.py
│   ├── firmographics.py
│   ├── npi.py
│   └── warehouse.py
├── services/         # Business logic services
├── tasks/            # Celery background tasks
└── web/              # FastAPI application
    └── routers/      # API route handlers
```

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Python 3.12+
- Poetry (for local development)
- **Pre-commit** (required for all contributors)
- Access to AWS services (Redshift, S3, etc.)
- Redis
- PostgreSQL
- Kafka

### Development Tools Setup

#### Install pyenv (Python Version Manager)

**macOS** (using Homebrew):
```bash
# Install pyenv
brew install pyenv

# Add pyenv to your shell configuration
echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.zshrc
echo 'command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.zshrc
echo 'eval "$(pyenv init -)"' >> ~/.zshrc

# Restart your shell or reload config
source ~/.zshrc

# Install Python 3.12
pyenv install 3.12.4

# Set as global or local version
pyenv global 3.12.4  # or: pyenv local 3.12.4
```

**Linux** (using pyenv-installer):
```bash
# Install dependencies (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y make build-essential libssl-dev zlib1g-dev \
libbz2-dev libreadline-dev libsqlite3-dev wget curl llvm \
libncursesw5-dev xz-utils tk-dev libxml2-dev libxmlsec1-dev libffi-dev liblzma-dev

# Install pyenv
curl https://pyenv.run | bash

# Add to ~/.bashrc or ~/.zshrc
echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.bashrc
echo 'command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.bashrc
echo 'eval "$(pyenv init -)"' >> ~/.bashrc

# Restart shell
exec "$SHELL"

# Install Python 3.12
pyenv install 3.12.4
pyenv global 3.12.4
```

**Windows** (using pyenv-win):
```powershell
# Install pyenv-win using PowerShell
Invoke-WebRequest -UseBasicParsing -Uri "https://raw.githubusercontent.com/pyenv-win/pyenv-win/master/pyenv-win/install-pyenv-win.ps1" -OutFile "./install-pyenv-win.ps1"; &"./install-pyenv-win.ps1"

# Or using Git (if you have Git installed)
git clone https://github.com/pyenv-win/pyenv-win.git "$HOME/.pyenv"

# Add to PATH (run in PowerShell as Administrator or add manually to System Environment Variables)
[System.Environment]::SetEnvironmentVariable('PYENV',$env:USERPROFILE + "\.pyenv\pyenv-win\","User")
[System.Environment]::SetEnvironmentVariable('PYENV_ROOT',$env:USERPROFILE + "\.pyenv\pyenv-win\","User")
[System.Environment]::SetEnvironmentVariable('PYENV_HOME',$env:USERPROFILE + "\.pyenv\pyenv-win\","User")

$path = [System.Environment]::GetEnvironmentVariable('PATH', 'User')
$path = $env:PYENV + 'bin;' + $env:PYENV + 'shims;' + $path
[System.Environment]::SetEnvironmentVariable('PATH', $path, 'User')

# Restart PowerShell, then install Python 3.12
pyenv install 3.12.4
pyenv global 3.12.4

# Verify
pyenv version
```

#### Install Poetry (Dependency Manager)

**Recommended Method** (Official Installer):
```bash
# Install Poetry
curl -sSL https://install.python-poetry.org | python3 -

# Add Poetry to PATH (if not already added)
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Verify installation
poetry --version
```

**Alternative** (using pipx):
```bash
# Install pipx first
python3 -m pip install --user pipx
python3 -m pipx ensurepath

# Install Poetry with pipx
pipx install poetry

# Verify installation
poetry --version
```

**Windows** (PowerShell):
```powershell
# Using official installer
(Invoke-WebRequest -Uri https://install.python-poetry.org -UseBasicParsing).Content | py -

# Add Poetry to PATH (if not automatically added)
$env:PATH += ";$env:APPDATA\Python\Scripts"

# Make PATH change permanent
[System.Environment]::SetEnvironmentVariable('PATH', $env:PATH, 'User')

# Verify installation
poetry --version
```

**Configure Poetry** (recommended settings):
```bash
# Create virtual environments inside project directories
poetry config virtualenvs.in-project true

# Verify configuration
poetry config --list
```

#### Verify Setup

```bash
# Check Python version
python --version  # Should show 3.12.x

# Check Poetry version
poetry --version  # Should show 1.7.0 or higher

# Check pyenv is managing Python
pyenv versions
```

### Environment Setup

Create a `.env` file with the following variables:

```bash
# AWS Redshift
CONFIG_AWS_REDSHIFT_URL=your-redshift-url
CONFIG_AWS_REDSHIFT_PORT=5439
CONFIG_AWS_REDSHIFT_DB=your-db
CONFIG_AWS_REDSHIFT_USER=your-user
CONFIG_AWS_REDSHIFT_PASSWORD=your-password

# AWS Credentials
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_DEFAULT_REGION=us-east-1

# S3 Buckets
DS_BUCKET=your-data-science-bucket
INTEGRATION_BUCKET=your-integration-bucket

# Database (PostgreSQL)
CONFIG_DB_HOST=localhost
CONFIG_DB_PORT=5432
CONFIG_DB_NAME=postgres
CONFIG_DB_USER=admin
CONFIG_DB_PASSWORD=admin

# Redis
CONFIG_REDIS_URL=redis://localhost:6379/0
CONFIG_REDIS_HOST=localhost
CONFIG_REDIS_PORT=6379

# Kafka
CONFIG_KAFKA_BROKERS=localhost:9092
CONFIG_KAFKA_CONSUMER_BROKERS=localhost:9092

# Integration Services
CONFIG_INTEGRATION_SERVICE_API_URL=your-integration-api-url
CONFIG_INTEGRATION_SERVICE_API_KEY=your-api-key

# Slack (optional)
CONFIG_SLACK_TOKEN=your-slack-token
```

### Installation

#### Using Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The Docker Compose setup includes the following services:

**Core Application Services:**
- **warehouse-api** (port 1337): FastAPI web application with hot-reload enabled
- **warehouse-worker**: Celery worker for background task processing
- **warehouse-beat**: Celery beat scheduler for periodic tasks
- **facts-consumer**: Kafka consumer for facts event processing

**Infrastructure Services:**
- **postgres** (port 5432): PostgreSQL database for operational data
- **redis** (port 6379): Redis cache and Celery message broker
- **broker** (ports 9092, 29092): Kafka broker for event streaming

All application services include health checks and proper dependency management to ensure services start in the correct order.

#### Local Development

Local development should be done using Docker Compose (see above). However, you can set up the local environment for running tests and pre-commit hooks:

```bash
# Install dependencies
poetry install

# Install pre-commit hooks (REQUIRED)
pre-commit install

# Run tests locally (without Docker)
poetry run pytest

# Run specific tests
poetry run pytest tests/services/test_match.py -v
```

For running the full application stack (API, workers, beat scheduler), use Docker Compose.

### CLI Usage

```bash
# Access CLI commands
poetry run datapooler --help

# Facts CLI commands
poetry run datapooler facts --help
```

## API Documentation

Once the service is running, access the interactive API documentation:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Database Migrations

```bash
# Create a new migration
poetry run alembic revision --autogenerate -m "description"

# Apply migrations
poetry run alembic upgrade head

# Rollback migration
poetry run alembic downgrade -1

# View migration history
poetry run alembic history
```

## Testing

```bash
# Run all tests
poetry run pytest

# Run with coverage
poetry run pytest --cov=datapooler

# Run specific test file
poetry run pytest tests/services/test_match.py

# Run with verbose output
poetry run pytest -v

# Run specific test by name
poetry run pytest -k "test_match_service"
```

### Test Fixtures

The project includes comprehensive test fixtures for unit and integration testing:

#### Database Fixtures

**Session & Engine Fixtures**
- `sqlite_engine`: In-memory SQLite engine for fast testing
- `patch_db_name`: Patches database name to use test database
- `patch_async_db_name`: Async database engine for async tests
- `set_database`: Creates and tears down test database schema

**Repository Test Data (SQLite-based)**
- `equifax_table`: Equifax test data with standardized schema
- `zoominfo_table`: ZoomInfo company data
- `open_corporate_table`: OpenCorporate entities
- `canada_open_table`: Canadian business registry data
- `npi_table`: National Provider Identifier (healthcare) data

All repository fixtures include realistic test data with multiple records.

#### Business Entity Fixtures

**Mock Business Data**
- `worth_businesses`: Worth platform business entities
- `equifax_businesses`: Equifax business records
- `zoominfo_businesses`: ZoomInfo company profiles
- `open_corporate_businesses`: OpenCorporate entities
- `canada_open_businesses`: Canadian business entities
- `npi_businesses`: Healthcare provider records

Each fixture is parameterized and can generate N test records.

#### Integration Data Fixtures

**Third-party Integration Test Data** (JSON files in `tests/data/integrations/`)
- `middesk_business_entity_verification_data`: Middesk verification responses
- `rutter_balance_sheet_data`: Rutter balance sheet data
- `rutter_business_info_data`: Rutter business information
- `rutter_cash_flow_data`: Rutter cash flow statements
- `rutter_income_statement_data`: Rutter income statements
- `plaid_assests_report_data`: Plaid asset reports
- `verdata_public_records_data`: Verdata public records
- `equifax_judgements_liens_data`: Equifax judgments and liens

All integration data is stored as compressed JSON (.json.gz) for realistic testing.

#### Repository Mocks

**Match Repository Mocks**
- `mock_canada_open_repository`: Mocks Canadian business matching
- `mock_equifax_repository`: Mocks Equifax data retrieval
- `mock_zoominfo_repository`: Mocks ZoomInfo matching
- `mock_open_corporate_repository`: Mocks OpenCorporate queries

These mocks patch the actual repository `get_matches` methods with test data.

#### Service & API Fixtures

- `api_client`: FastAPI TestClient for API endpoint testing
- `mock_firmographics_data`: Mock firmographics enrichment data
- `simple_firmographics_service`: Pre-configured FirmographicsService for testing
- `integration_test_data`: Parameterized fixture for testing all integration sources

#### Request Fixtures

- `seed_request`: Creates test match request (US address)
- `seed_request_ca`: Creates test match request (Canadian address)
- `seed_request_uk`: Creates test match request (UK address)
- `start_matching_request`: MatchRequest model for API testing

#### Auto-mocked Services

- `mock_kafka_messaging`: Automatically mocks Kafka connections (session-scoped, autouse)
  - Prevents actual Kafka connections during tests
  - Tracks message sends for assertions

### Testing Best Practices

- Use SQLite fixtures for repository testing (fast, isolated)
- Use mock repositories for service-level tests
- Integration test data is based on real API responses
- All fixtures are session-scoped where possible for performance
- Database state is cleaned up after each test function

## Code Documentation Standards

The codebase follows comprehensive documentation practices:

### Module Docstrings

Every Python module includes a docstring explaining:
- Module purpose and functionality
- Key components and classes
- High-level architecture or data flow
- Important configuration or dependencies

### Class Documentation

Classes include:
- Purpose and responsibility
- Key attributes and their meaning
- Usage patterns and examples where helpful

### Method Documentation

Public methods document:
- Purpose and behavior
- Parameters with types and descriptions
- Return values and types
- Exceptions raised
- Side effects (database writes, API calls, etc.)

### Inline Comments

Strategic inline comments explain:
- Non-obvious business logic
- Complex algorithms or calculations
- Workarounds or special cases
- Performance optimizations

### Examples

See well-documented modules:
- [datapooler/web/app.py](datapooler/web/app.py) - FastAPI application setup
- [datapooler/config.py](datapooler/config.py) - Configuration management
- [datapooler/adapters/engines.py](datapooler/adapters/engines.py) - Database engines
- [datapooler/services/match.py](datapooler/services/match.py) - Entity matching service

## Development

### Code Formatting & Pre-commit Hooks

**Pre-commit hooks are MANDATORY** for all contributors. The project enforces code quality through automated checks on every commit.

#### Pre-commit Configuration

The following hooks are automatically run on each commit:
- **Trailing Whitespace**: Removes trailing whitespace
- **End of File Fixer**: Ensures files end with a newline
- **YAML/JSON/TOML Validation**: Validates file integrity
- **Type Annotations**: Enforces Python type hints
- **PyUpgrade**: Upgrades syntax for newer Python versions
- **Black**: Code formatting (line length: 100)
- **isort**: Import sorting (black-compatible profile)
- **Flake8**: Linting and style enforcement

#### Setup (Required)

```bash
# Install pre-commit hooks (run this once after cloning)
pre-commit install

# Run all hooks manually
pre-commit run --all-files

# Run specific hook
pre-commit run black --all-files

# Skip hooks (only in emergencies - not recommended)
git commit --no-verify
```

#### Manual Formatting

While pre-commit handles most formatting automatically, you can also run tools manually:

```bash
# Format code with black
poetry run black datapooler/

# Sort imports
poetry run isort datapooler/

# Run flake8 linting
poetry run flake8 datapooler/
```

### Configuration

Configuration is managed through environment variables using Pydantic Settings. See [datapooler/config.py](datapooler/config.py) for all available options.

## Architecture

### Matching Pipeline

1. Business data is received via API or Kafka events
2. Similarity features are extracted from business attributes
3. XGBoost model predicts match probability against integration data sources
4. Top matches are returned and stored in the warehouse
5. Firmographic data is enriched from matched entities

### Data Flow

```
API/Kafka → Match Service → Similarity Service → ML Model
                ↓
         Match Results → Firmographics Service → Enriched Data
                ↓
         Database/Warehouse → Export/Analytics
```

## Monitoring & Observability

- **Structured Logging**: JSON-formatted logs for all services
- **Datadog APM**: Application performance monitoring and tracing
- **Health Checks**: `/api/health` endpoint for service monitoring
- **Slack Notifications**: Configurable alerts for critical events

## Docker Services

### Container Architecture

The application is containerized using a multi-stage Docker build with Python 3.12-slim base image. The build process:
1. Exports Poetry dependencies to requirements.txt
2. Installs system dependencies (PostgreSQL client, AWS CLI, etc.)
3. Installs Python packages and the datapooler package

### Service Ports

- **API**: `1337` - Main FastAPI application
- **PostgreSQL**: `5432` - Database server
- **Redis**: `6379` - Cache and message broker
- **Kafka**: `9092` (host), `29092` (internal) - Message streaming

### Running Individual Services

```bash
# Start only infrastructure services
docker-compose up -d postgres redis broker

# Start the API only
docker-compose up warehouse-api

# Scale workers
docker-compose up --scale warehouse-worker=3

# View service logs
docker-compose logs -f warehouse-api
docker-compose logs -f warehouse-worker

# Execute commands in running containers
docker-compose exec warehouse-api bash
docker-compose exec warehouse-worker celery -A datapooler.adapters.queues.celery:TaskQueue inspect active
```

### Development Mode

To enable hot-reload for local development, uncomment the volume mount in docker-compose.yaml:

```yaml
warehouse-api:
  volumes:
    - ".:/code"  # Mounts local code into container
```

## CI/CD Pipeline

The project uses GitHub Actions for continuous integration and deployment across multiple environments.

### Automated Workflows

#### Code Quality & Testing

**Pre-commit Hooks** (runs on every push)
- Validates code formatting with Black and isort
- Runs Flake8 linting
- Checks YAML, JSON, and TOML file integrity
- Enforces type annotations
- Auto-fixes trailing whitespace and end-of-file issues

**Run Tests with Docker** (runs on every push)
- Builds all services using Docker Compose
- Runs pytest test suite in containerized environment
- Dumps logs on failure for debugging
- Configured with test environment variables

**PR Title Format Validation**
- Enforces JIRA ID format: `WIN-123: Description #FLAG/#LIVE`
- Requires `#NO_JIRA` tag if no JIRA ticket exists
- Requires `#FLAG` (feature flag controlled) or `#LIVE` (always on)
- Release branches must include `#HOTFIX` or `#FAST` tags
- Automatically comments with JIRA link

#### Build & Deployment Workflows

**Development** (`main` branch)
- Builds Docker image on push to main
- Tags with format: `{branch}_{short-sha}`
- Pushes to AWS ECR
- Creates deployment PR to dev environment
- Verifies branch is up-to-date with main

**Staging** (release branches)
- Triggered on release branch pushes or manual dispatch
- Builds and pushes to staging ECR repository
- Creates deployment PR to staging environment

**QA** (manual dispatch)
- On-demand builds for QA environment
- Supports building from any branch, tag, or commit

**Production** (tagged releases)
- Triggered by version tags
- Builds production-ready images
- Deploys to production environment
- Requires manual approval

#### Release Management

**Create Release Branch**
- Automated release branch creation
- Updates version numbers
- Creates release PR

**Cherry-pick to Release**
- Automatically cherry-picks commits to release branches
- Triggered by specific labels on PRs

**Hotfix Reporting**
- Tracks and reports hotfix deployments
- Notifies team via Slack

**Cleanup Workflows**
- Removes stale release branches
- Cleans up old Docker images

### Environment Variables

CI/CD workflows use GitHub Secrets and Variables:
- `AWS_ACCESS_KEY_ID`, `AWS_ACCESS_KEY_SECRET`: AWS credentials
- `ECR_REPOSITORY`: ECR repository name for service images
- `CONFIG_SLACK_TOKEN`: Slack notifications
- Environment-specific configs in GitHub Environments (dev, staging, qa, production)

### LaunchDarkly Integration

**LD Find Flags**
- Automatically detects feature flag usage in code
- Updates LaunchDarkly with code references
- Helps track flag usage across the codebase

## Contributing

### Workflow

1. Create a feature branch from `main`
2. Make your changes
3. **Ensure pre-commit hooks are installed** (`pre-commit install`)
4. Write tests for new functionality
5. Run tests locally: `pytest`
6. Commit changes (pre-commit hooks will run automatically)
7. Push to your branch
8. Create a Pull Request with proper title format:
   - Format: `JIRA-ID: Description #FLAG/#LIVE`
   - Example: `WIN-123: Add business matching endpoint #FLAG`
   - Use `#NO_JIRA` if no ticket exists
9. Wait for CI checks to pass
10. Request code review

### PR Title Requirements

- **JIRA ID**: Must start with JIRA ticket (e.g., `WIN-123`) OR include `#NO_JIRA`
- **Feature Flag Tag**: Must include `#FLAG` (if feature can be toggled) or `#LIVE` (if always on)
- **Release Tags**: PRs to release branches must include `#HOTFIX` or `#FAST`

### Code Review Guidelines

- All tests must pass
- Pre-commit checks must pass
- Code coverage should not decrease
- At least one approval required
- Address all review comments before merging

## License

Proprietary - WorthAI

## Contact

Sam Stiyer - sam.stiyer@gmail.com
